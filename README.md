# Chat con i bot

Sito personale per chattare con **Berlusc**, **Syrup** e **Aurelio**.

Stack: Next.js 16 (App Router), React 19, Tailwind CSS 4, Upstash Redis.

## Come funziona: la bacheca

Niente webhook. Il sito fa da **bacheca**: tu scrivi, l'agent passa ogni tanto a leggere e risponde.

```
Tu ──scrivi──▶ bacheca (Redis) ◀──GET /api/board (ogni tot)── agent
Tu ◀─chat──── bacheca (Redis) ◀──POST /api/board (risposta)── agent
```

- Il sito è protetto da password (`APP_PASSWORD`).
- La bacheca è pubblica ma serve il segreto (`INBOUND_SECRET`).
- In chat sotto il tuo ultimo messaggio vedi **Inviato ✓** e poi **Letto ✓✓** appena l'agent l'ha scaricato.

## Istruzioni per l'agent

Autenticazione: header `Authorization: Bearer <INBOUND_SECRET>` (oppure `&token=<INBOUND_SECRET>` nell'URL).

### 1. Leggere i messaggi nuovi

```
GET https://<sito>/api/board?bot=berlu&since=<cursor>
```

Risposta:

```json
{
  "messages": [
    { "id": "…", "bot": "berlu", "from": "me", "text": "ciao", "ts": 1793807174683, "at": "2026-11-04T15:46:14.683Z" }
  ],
  "cursor": 1793807174683
}
```

- La prima volta `since` si può omettere (o `0`).
- Al giro dopo si passa il `cursor` ricevuto: arrivano solo i messaggi nuovi.
- Senza `bot` arrivano i messaggi di tutti e tre (`berlu`, `syrup`, `aurelio`).
- Con `&all=1` arrivano anche le risposte già date dai bot (`from: "bot"`), utile come contesto.

### 2. Rispondere (testo, foto, video)

**Solo testo:**

```
POST https://<sito>/api/board?bot=berlu
Content-Type: application/json

{ "message": "testo della risposta" }
```

**Con foto o video tramite link** (consigliato per i video pesanti):

```json
{ "message": "guarda qua", "media": ["https://.../foto.jpg", "https://.../clip.mp4"] }
```

Il tipo si capisce dall'estensione (`.mp4`, `.webm`, `.mov` sono video, il resto foto). Se il link non ha estensione, si specifica così: `{ "url": "https://...", "type": "video" }`. Vanno bene anche i campi `image`, `images`, `video`, `videos`.

**Caricando il file vero** (multipart, come un form):

```bash
curl -X POST "https://<sito>/api/board?bot=syrup" \
  -H "Authorization: Bearer <INBOUND_SECRET>" \
  -F "message=ecco la foto" \
  -F "file=@foto.jpg"
```

Più file insieme si mandano ripetendo `-F "file=@..."` (massimo 10). In alternativa, in JSON, si può passare il file in base64: `{ "media": [{ "data": "<base64>", "mime": "image/png" }] }`.

- Formati accettati: JPG, PNG, GIF, WebP, AVIF, HEIC e video MP4, WebM, MOV.
- **Limite:** Netlify accetta richieste fino a circa **6 MB**. Per video più grandi bisogna mandare un link.
- I file caricati vanno su **Netlify Blobs** (incluso in Netlify, niente da configurare) e li vedi solo tu dopo il login.
- Testo e media sono entrambi facoltativi, ma almeno uno ci deve essere.

Il bot si può indicare anche nel body (`"bot": "berlu"`). Il testo può stare in `message`, `text`, `content`, `reply` o `caption`.

### Prova veloce

```bash
curl "https://<sito>/api/board?bot=berlu" -H "Authorization: Bearer <INBOUND_SECRET>"
curl -X POST "https://<sito>/api/board?bot=berlu" -H "Authorization: Bearer <INBOUND_SECRET>" -H "Content-Type: application/json" -d '{"message":"yo"}'
```

## Avvio in locale

```bash
npm install
cp .env.example .env.local   # metti almeno APP_PASSWORD e INBOUND_SECRET
npm run dev
```

Senza Redis i messaggi stanno in memoria e si perdono al riavvio.

## Deploy (Netlify)

1. Importa il repo da GitHub. Netlify riconosce Next.js da solo: build command `npm run build`, publish directory `.next`.
2. Crea un database Redis gratuito su [console.upstash.com](https://console.upstash.com) e copia URL e token dalla sezione REST API.
3. In **Environment variables** aggiungi le variabili di `.env.example`, poi rifai il deploy.

Funziona uguale su Vercel. Lì Upstash si collega dal Marketplace e le variabili si aggiungono da sole.

# Hub personale

Il tuo spazio unico: cosa è attivo **adesso**, annunci importanti, progetti con checkpoint, dropshipping (prodotti + pubblicità), media, chat con gli agent e classifiche dei modelli AI.

| Sezione | Cosa fa |
|---|---|
| **Adesso** (`/`) | Home: annunci da leggere, progetti attivi, ultimi messaggi dei bot, media, numeri del dropshipping, podio dei modelli. |
| **Annunci** | La casella che conta: solo cose importanti, da agent o sezioni dell'hub. Anti-rumore: dedupe + max 5 al giorno per fonte. |
| **Progetti** | Stato attuale, prossimi passi e **conoscenze** (errori, esperienza, ricerche, correzioni) accumulate dai checkpoint. Gli agent li leggono e li aggiornano. |
| **Dropshipping** | Prodotti e pubblicità collegati tra loro e ai media (spesa, ricavi, ROAS, margine). |
| **Media** | Tutte le foto/video mandati dai bot + i tuoi upload, filtrabili per bot e tipo. |
| **Agenti** | Chat con i bot (Grok ecc.) e note per i bot. |
| **Modelli AI** | Classifiche LLM / immagini / video con tutti i benchmark, e **Confronta** tra i modelli che scegli. |

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
- Nella sezione **Annunci** (📌) lasci note fisse e per ognuna scegli quali bot possono leggerla. Se non ne selezioni nessuno, la nota resta privata.

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
  "cursor": 1793807174683,
  "notes": [
    { "id": "…", "text": "Sabato cena da me alle 21", "at": "2026-11-04T19:56:00.000Z" }
  ]
}
```

- `notes` sono gli **annunci** che hai reso visibili a quel bot: arrivano sempre tutti, a ogni lettura.
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

**Bot nuovi:** se un bot che non esiste ancora risponde, viene creato da solo e compare in lista. Il nome si passa in `name` (vanno bene anche `bot_name`, `botName`, `sender` o `?name=`): `POST /api/board?bot=neo` con `{ "name": "Neo", "message": "ciao" }`. Se manca `bot` ma c'è `name`, l'id si ricava dal nome (`"Mr. Smith"` diventa `mr-smith`). Il nome si fissa alla prima risposta e non cambia più. Limite: 50 bot.

Il bot si può indicare anche nel body (`"bot": "berlu"`). Il testo può stare in `message`, `text`, `content`, `reply` o `caption`.

### Prova veloce

```bash
curl "https://<sito>/api/board?bot=berlu" -H "Authorization: Bearer <INBOUND_SECRET>"
curl -X POST "https://<sito>/api/board?bot=berlu" -H "Authorization: Bearer <INBOUND_SECRET>" -H "Content-Type: application/json" -d '{"message":"yo"}'
```

## API per gli agent

Tutte con `Authorization: Bearer <INBOUND_SECRET>` (o `?token=`). **`GET /api/agent`** restituisce le istruzioni complete, leggibili dall'agent stesso.

| Endpoint | |
|---|---|
| `GET /api/agent/projects` | Progetti con l'ultimo checkpoint |
| `GET /api/agent/projects/<id>` | Progetto completo: checkpoint + conoscenze |
| `POST /api/agent/projects/<id>/checkpoints` | `{author, summary, progress?, next?: [], learnings?: [{kind, text}]}`; kind: `errore`, `esperienza`, `ricerca`, `correzione` |
| `POST /api/agent/alerts` | `{source, title, level: "importante" o "urgente", body?, link?, dedupeKey?}`; solo se serve davvero |
| `POST /api/agent/heartbeat` | Segnale di vita: `{agent, name?, status?: attivo, occupato o in pausa, doing?, projectId?}`. Online se l'ultimo è di meno di 15 minuti fa: compare in "Chi è sveglio" su Adesso. |
| `GET /api/agent/products` | Prodotti e pubblicità, per collegare i media (`product` / `ad` in `POST /api/board`) |
| `POST /api/agent/models` | Carica una classifica: `{kind: "llm", "image" o "video", source, models: [{name, org, open?, scores: {benchmark: valore}}]}` |

## Modelli AI: da dove arrivano i dati

Da **Artificial Analysis** (Intelligence Index, MMLU-Pro, GPQA, HLE, LiveCodeBench…, arene immagini e video). Crea una chiave API gratuita su artificialanalysis.ai e aggiungila su Netlify come `AA_API_KEY`: i dati si aggiornano da soli una volta al giorno (o con il pulsante "Aggiorna"). In alternativa un agent può caricarli con `POST /api/agent/models`.

## Sveglia dei bot via email

Quando scrivi a un bot (o crei una nota visibile a lui) l'hub gli manda una mail di sveglia alla casella comune, con il **tag del bot** nell'indirizzo: `pandoro+syrup@mail.grokbot.com`. Il nome è anche nell'oggetto: `[syrup] Nuovo messaggio per Syrup`.

- Niente raffiche: se il bot è già stato svegliato e non ha ancora letto la bacheca, non parte un'altra mail (riprova dopo 15 minuti se dorme ancora).
- Si attiva impostando `WAKE_EMAIL` e il server di posta (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`): vedi `.env.example`.

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

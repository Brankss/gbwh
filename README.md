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

### 2. Rispondere

```
POST https://<sito>/api/board?bot=berlu
Content-Type: application/json

{ "message": "testo della risposta" }
```

Il bot si può indicare anche nel body (`"bot": "berlu"`). Il testo può stare in `message`, `text`, `content` o `reply`.

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

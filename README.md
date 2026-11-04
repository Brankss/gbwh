# Chat con i bot

Sito personale per chattare con **Berlusc**, **Syrup** e **Aurelio**.

Stack: Next.js 16 (App Router), React 19, Tailwind CSS 4, Upstash Redis. Va in deploy su Vercel.

## Come funziona

```
Browser ──POST /api/send──▶ server ──webhook (Bearer key)──▶ bot
Browser ◀─GET /api/messages (polling)── Redis ◀──POST /api/inbound── bot
```

- Le **chiavi dei bot stanno solo sul server** (variabili d'ambiente). Il browser non le vede mai.
- Tutto il sito è protetto da password (`APP_PASSWORD`).
- I bot rispondono su un **indirizzo pubblico** protetto da un segreto (`INBOUND_SECRET`).
- Il client controlla se ci sono novità ogni 2 secondi, ma solo con la tab aperta, e scarica i messaggi solo quando cambia qualcosa. Così costa praticamente zero.

## Avvio in locale

```bash
npm install
cp .env.example .env.local   # metti almeno APP_PASSWORD e INBOUND_SECRET
npm run dev
```

Senza Redis i messaggi stanno in memoria. Senza webhook configurati, in locale i bot rispondono in **modalità demo** così puoi provare la UI.

## Deploy su Vercel

1. Importa il repo su [vercel.com/new](https://vercel.com/new).
2. Nel progetto vai su **Storage**, poi **Upstash for Redis**, poi **Connect**. Le variabili `KV_REST_API_URL` e `KV_REST_API_TOKEN` vengono aggiunte da sole.
3. In **Settings → Environment Variables** aggiungi le altre variabili di `.env.example`.
4. Fai un redeploy.

## Indirizzo da dare ai bot

```
POST https://<tuo-sito>.vercel.app/api/inbound?bot=berlu
Authorization: Bearer <INBOUND_SECRET>
Content-Type: application/json

{ "message": "ciao!" }
```

- `bot` può essere `berlu`, `syrup` o `aurelio` (si può mettere anche nel body come `"bot"`).
- Se non possono mandare header, il segreto va anche in query: `?bot=syrup&token=<INBOUND_SECRET>`.
- Il testo viene letto da `message`, `text`, `content` o `reply`. Va bene anche testo semplice nel body.

Prova veloce:

```bash
curl -X POST "https://<tuo-sito>.vercel.app/api/inbound?bot=syrup" \
  -H "Authorization: Bearer <INBOUND_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"message":"yo"}'
```

# UGC Factory: progetto tecnico

La UGC Factory è una catena di montaggio per video pubblicitari UGC, lavorata da una squadra di bot (e da Branko). Il punto debole visto nei primi test non è il generatore video ma **l'idea del video**. Per questo la catena mette la creatività in fasi esplicite, con un gate del critico **prima** di spendere per produrre, e tiene tutto nell'hub così la factory è ripetibile e impara dai numeri veri.

La generazione video **non** è parte dell'hub: ogni bot usa il suo strumento (oggi Grok Imagine integrato in GrokBot). L'hub conserva brief, idee, script, revisioni, video finiti, numeri e lezioni. Cambiare generatore non cambia nulla qui.

## La catena

| Fase (`stage`) | Chi | Cosa |
|---|---|---|
| `idea` | regista | Concept: angolo, format (dalla libreria), 3+ hook, storia hook → build-up → payoff → CTA, perché ferma lo scroll |
| `gate` | critico | Revisione del concept **prima** della produzione |
| `script` | regista | Scene da 2–5 s: inquadratura, azione, battuta, testo a schermo |
| `produzione` | producer | Genera, monta, controlla la qualità, carica il video |
| `revisione` | critico | Revisione del video montato |
| `pronto` | Branko | Guarda e decide se metterlo in test (arriva un Annuncio) |
| `in_test` | analista | Numeri veri (spesa, hook rate, CTR, ROAS) |
| `vincente` / `scartato` | analista | Esito; la lezione va nel Playbook |

Passaggi automatici (in `src/lib/ugc-store.ts`):
- Revisione al **gate**: `approvato` porta a `script`, `da rifare` porta a `idea`, `scartato` porta a `scartato`.
- Revisione in **revisione video**: `approvato` porta a `pronto`, `da rifare` porta a `produzione`, `scartato` porta a `scartato`. Lo stato del video segue l'esito.
- Video caricato con `status: "in revisione"` mentre il concept è in `produzione` o in `script`: il concept passa a `revisione`.
- Primi numeri su un video `pronto`: il concept passa a `in_test`, il video a `pubblicato`.
- Fase `pronto` o `vincente`: parte un Annuncio per Branko (con dedupe).
- A ogni cambio di fase si sveglia via email il bot che ha il ruolo di quella fase (`settings.roles`), se `autoWake` è attivo e quel bot non è lo stesso che ha fatto il passaggio.

## Dati

- Tipi e costanti: `src/lib/ugc.ts` (fasi, ruoli, documenti, `summarize()` per i numeri).
- Libreria creativa: `src/lib/ugc-library.ts`. Contiene i `FORMATS` e gli `HOOK_TYPES` con id stabili; i concept salvano l'id del format, e un format inesistente viene rifiutato.

Collezioni in Redis (un hash per collezione via `src/lib/db.ts`):

| Collezione | Cosa contiene |
|---|---|
| `ugc_briefs` | prodotto, target, problema, promessa, prove, offerta, obiezioni, angoli |
| `ugc_research` | per brief: `ad competitor`, `voce cliente`, `insight`, `trend` |
| `ugc_concepts` | angolo, format, hook, storia, scene, fase |
| `ugc_reviews` | revisioni del critico (gate o video) con voto, "ferma lo scroll?", correzioni |
| `ugc_videos` | versioni del video (media `{url, type}`), checklist QA, stato |
| `ugc_results` | numeri per video, piattaforma e giorno (stesso giorno = aggiorna) |
| `ugc_learnings` | il **Playbook**: hook / format / angolo / produzione / errore / regola, `ipotesi` o `provato` |

Più due chiavi a parte:
- `ugc:settings`: chi fa quale ruolo, e se la sveglia è automatica;
- `ugc:log`: il registro delle modifiche.

## API per la pagina (sessione, `/api/ugc/...`)

| Metodo e percorso | Cosa fa |
|---|---|
| `GET /api/ugc` | Panoramica: `byStage`, `briefList` (con conteggi), `concepts`, `settings`, `bots`, `log` |
| `POST /api/ugc/briefs` | Crea un brief |
| `GET`, `PATCH`, `DELETE /api/ugc/briefs/[id]` | `GET` restituisce `{brief, research, concepts}` |
| `POST /api/ugc/briefs/[id]/research` | Aggiunge una voce di ricerca |
| `DELETE /api/ugc/research/[id]` | Elimina una voce di ricerca |
| `POST /api/ugc/concepts` | Crea un concept |
| `GET`, `PATCH`, `DELETE /api/ugc/concepts/[id]` | `GET` restituisce `ConceptFull` + `log`. `PATCH` accetta i campi e/o `stage` (+ `note`) |
| `POST /api/ugc/concepts/[id]/reviews` | Revisione (anche Branko può fare il critico) |
| `POST /api/ugc/concepts/[id]/videos` | Carica un video: multipart `file` oppure JSON `{media:{url,type}}` |
| `GET /api/ugc/videos` | Tutti i video con concept e risultati |
| `PATCH`, `DELETE /api/ugc/videos/[id]` | Modifica o elimina un video |
| `POST /api/ugc/videos/[id]/results` | Aggiunge i numeri di un video |
| `DELETE /api/ugc/results/[id]` | Elimina un risultato |
| `GET`, `POST /api/ugc/learnings` | Legge o aggiunge voci del Playbook |
| `PATCH`, `DELETE /api/ugc/learnings/[id]` | Modifica o elimina una voce del Playbook |
| `PATCH /api/ugc/settings` | `{roles?: {stratega: botId \| null, …}, autoWake?}` |

## API per gli agent (token, `/api/agent/ugc/...`)

Stesso storage, con queste differenze rispetto alla pagina:
- ogni scrittura porta `agent` (l'id del bot);
- `GET /api/agent/ugc` restituisce il protocollo completo, leggibile dall'agent;
- `GET /api/agent/ugc/queue?role=…` (o `?agent=` per i ruoli assegnati a quel bot) restituisce il lavoro da fare;
- i video si caricano come link, `{url}`, `{data: base64, mime}` o multipart, come in `/api/board`.

## Pagine

| Pagina | Cosa mostra |
|---|---|
| `/ugc` | Catena (bacheca per fasi), Brief, Playbook, Risultati, Squadra |
| `/ugc/brief/[id]` | Brief, ricerca e concept del brief |
| `/ugc/[id]` | Concept: fasi, hook, storia, storyboard, revisioni, video, numeri, registro |

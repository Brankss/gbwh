// Libreria creativa della UGC Factory: i format e i tipi di hook da cui gli agent SCELGONO
// (niente format inventati a caso). Gli id sono stabili: li salvano i concept.
// Contenuto in italiano, pensato per insegnare il "gusto" pubblicitario, non solo la teoria.
//
// Come si usa:
// - Regista: parte dal livello di consapevolezza del pubblico (AWARENESS_LEVELS), sceglie il format
//   che ci sta sopra, legge i suoi beat e le sue trappole, poi scrive 3+ hook di tipo diverso.
//   Gli esempi servono a capire il ragionamento: non si copiano.
// - Critico: giudica con REVIEW_RUBRIC (rubricFor + rubricScore) e decide con VERDICT_RULES.
// - Script: SCRIPT_RULES dicono come scrivere scene che il generatore video riesce a girare.
//
// Tutti i campi aggiunti ai tipi sono opzionali: chi legge solo i campi vecchi continua a funzionare.

/* ------------------------------------------------------------------ */
/* Livelli di consapevolezza (Eugene Schwartz, Breakthrough Advertising) */
/* ------------------------------------------------------------------ */

export type AwarenessId = "inconsapevole" | "problema" | "soluzione" | "prodotto" | "pronto";

/** Quanto sa già chi guarda: decide da dove deve partire il video. */
export const AWARENESS_LEVELS: { id: AwarenessId; name: string; text: string }[] = [
  {
    id: "inconsapevole",
    name: "Inconsapevole",
    text: "Non sa di avere il problema, o non ci pensa mai. Lo agganci con una situazione in cui si riconosce, una curiosità o puro intrattenimento: il prodotto arriva dopo. È la maggior parte del traffico freddo su TikTok e Reels.",
  },
  {
    id: "problema",
    name: "Consapevole del problema",
    text: "Sente il fastidio ma non conosce una soluzione. Nomina il problema con le sue parole, fallo sentire, poi mostra la via d'uscita. Qui vincono problema → soluzione, POV e mini storia.",
  },
  {
    id: "soluzione",
    name: "Consapevole della soluzione",
    text: "Sa che esistono soluzioni, ha già provato quelle classiche. Devi far vedere perché questa è diversa: il meccanismo, un confronto, un esperimento. «Funziona» non basta più, serve «funziona meglio di quello che hai già».",
  },
  {
    id: "prodotto",
    name: "Consapevole del prodotto",
    text: "Conosce il prodotto (o uno uguale) e ha un dubbio: funziona davvero? Vale il prezzo? Rispondi all'obiezione con prove: testimonianza, esperimento, 3 motivi.",
  },
  {
    id: "pronto",
    name: "Pronto a comprare",
    text: "Vuole comprare e aspetta solo una spinta: offerta, garanzia, spedizione, scorte. Video corto, diretto, CTA forte. Di solito è retargeting, non traffico freddo.",
  },
];

/* ------------------------------------------------------------------ */
/* Tipi                                                                */
/* ------------------------------------------------------------------ */

/** Un passaggio del video, con il tempo indicativo e il pezzo della storia (Story di ugc.ts) a cui appartiene. */
export type Beat = {
  /** Finestra di tempo indicativa, es. "0–2 s". */
  at: string;
  part: "hook" | "buildup" | "payoff" | "cta";
  name: string;
  what: string;
};

export type Format = {
  id: string;
  name: string;
  /** Quando usarlo (tipo di prodotto, livello di consapevolezza del pubblico). */
  when: string;
  /** Struttura del video, beat per beat (testo, generato da `beats`). */
  structure: string[];
  /** Un esempio concreto, raccontato come lo vedresti. */
  example: string;
  /** Errori che lo rovinano. */
  pitfalls: string[];
  /** Livelli di consapevolezza su cui funziona meglio. */
  awareness?: AwarenessId[];
  /** Tipi di prodotto su cui rende di più. */
  bestFor?: string[];
  /** Durata consigliata. */
  duration?: string;
  /** Struttura con tempi e parte della storia (hook / build-up / payoff / CTA). */
  beats?: Beat[];
  /** Perché ferma lo scroll e perché convince. */
  whyItWorks?: string;
  /** Un concept sbagliato con questo format, e perché non funziona. */
  badExample?: string;
};

export type HookType = {
  id: string;
  name: string;
  /** Cosa fa scattare nella testa di chi scrolla. */
  why: string;
  examples: string[];
  /** Cosa si vede nel primo secondo (il primo fotogramma deve funzionare anche muto). */
  firstFrame?: string;
  /** Id dei format con cui si sposa meglio. */
  pairsWith?: string[];
  /** Come va storto. */
  avoid?: string;
};

type FormatInput = Omit<Format, "structure" | "beats"> & { beats: Beat[] };

const fmt = (f: FormatInput): Format => ({
  ...f,
  structure: f.beats.map((b) => `${b.at} · ${b.name}: ${b.what}`),
});

/* ------------------------------------------------------------------ */
/* Format                                                              */
/* ------------------------------------------------------------------ */

export const FORMATS: Format[] = [
  fmt({
    id: "problema_soluzione",
    name: "Problema → soluzione",
    when: "Il cavallo di battaglia del traffico freddo. Per prodotti che tolgono un fastidio visibile e quotidiano (pulizia, organizzazione, dolori, animali). Funziona con chi sente il problema ma non conosce la soluzione. Se non sai quale format scegliere, parti da qui.",
    awareness: ["problema", "inconsapevole"],
    bestFor: ["pulizia casa", "gadget anti-fastidio", "cura animali", "postura e benessere"],
    duration: "20–35 s",
    beats: [
      { at: "0–2 s", part: "hook", name: "Problema in azione", what: "Il problema si VEDE (non si racconta), con una battuta che lo nomina con le parole del cliente." },
      { at: "2–7 s", part: "buildup", name: "Agita", what: "Perché è peggio di quanto sembra: tempo perso, imbarazzo, soldi, 1–2 tentativi falliti mostrati in fretta." },
      { at: "7–10 s", part: "buildup", name: "Svolta", what: "Il prodotto entra come risposta naturale («poi mia sorella mi ha detto: prova questo»), in mano e riconoscibile." },
      { at: "10–22 s", part: "payoff", name: "Prova", what: "Demo sullo STESSO problema dell'hook, risultato visibile mentre succede." },
      { at: "22–28 s", part: "payoff", name: "Conferma", what: "Il beneficio in una riga + un dettaglio che toglie l'obiezione principale." },
      { at: "28–32 s", part: "cta", name: "CTA", what: "Cosa fare adesso e perché ora (offerta, garanzia, accessorio incluso)." },
    ],
    example:
      "Spazzola elettrica rotante per fughe. Scena 1 (0–2 s): primo piano delle fughe nere della doccia, un dito ci passa sopra. Lei: «Le mie fughe. Dopo un'ora a strofinare.» Testo: «1 ora di spazzolino = questo». Scena 2: in ginocchio con lo spazzolino da denti, sudata, si massaggia il polso: «Candeggina, spazzolino, olio di gomito. Niente.» Scena 3: apre la mano, c'è la spazzola: «Mia sorella mi ha detto: prova questa.» Scena 4 (payoff): inquadratura fissa, la testina gira su una fuga: metà bianca, metà ancora nera, nella stessa inquadratura. Scena 5: piano largo, doccia intera pulita, lei seduta sul bordo: «Dieci minuti. E il polso non mi fa male.» Scena 6: «È qui sotto, c'è anche la testina per il lavandino.»",
    whyItWorks: "Chi ha il problema si riconosce nel primo fotogramma e pensa «questo sono io». La prova arriva nello stesso punto del problema, quindi il cervello non deve dedurre niente: vede il cerchio che si chiude.",
    pitfalls: [
      "Problema generico o detto invece che mostrato («odi pulire?»): nessuno si riconosce.",
      "Agitazione infinita: oltre 6–7 secondi di lamentele la gente scrolla prima della svolta.",
      "La demo risolve un problema diverso da quello dell'hook (hook sui peli, demo sulla polvere).",
      "Prodotto mostrato prima del problema: diventa uno showcase e perde la tensione.",
      "Taglio magico dal brutto al bello senza vedere il prodotto lavorare: sembra falso.",
    ],
    badExample:
      "Ragazza sorride in camera con la spazzola in mano, elenca «3 testine, 90 minuti di batteria, impermeabile», poi la passa su un lavandino già pulito. Nessun problema, nessuna prova: è la scheda prodotto letta ad alta voce.",
  }),
  fmt({
    id: "prima_dopo",
    name: "Prima / dopo",
    when: "Per trasformazioni visibili e d'impatto: arredamento, luci, pulizia profonda, organizzazione, auto. Funziona anche con chi non sa di volere il prodotto: il dopo bello ferma da solo e il desiderio nasce guardando. Il dopo deve essere credibile per il prezzo.",
    awareness: ["inconsapevole", "problema"],
    bestFor: ["home decor", "luci", "organizer", "pulizia profonda", "auto"],
    duration: "15–25 s",
    beats: [
      { at: "0–2 s", part: "hook", name: "Il dopo per primo", what: "Il risultato finale (o un flash), oppure un prima così brutto da far sorridere. Testo che fissa la promessa: tempo e prezzo." },
      { at: "2–6 s", part: "buildup", name: "Il prima, onesto", what: "Stessa inquadratura e stessa luce del dopo. Niente trucchi." },
      { at: "6–15 s", part: "buildup", name: "Processo compresso", what: "3–5 tagli veloci del prodotto che lavora, con un dettaglio soddisfacente." },
      { at: "15–21 s", part: "payoff", name: "Rivelazione", what: "Il dopo nella stessa inquadratura del prima, più una reazione o un dettaglio che si nota." },
      { at: "21–24 s", part: "cta", name: "CTA", what: "Dove trovarlo, con il prezzo se è un punto di forza." },
    ],
    example:
      "Lampada «tramonto» più strisce LED per la camera. Scena 1: camera di sera, cerchio di luce arancione sul muro, lei sul letto col telefono. Testo: «Da camera d'ospedale a così, con 34 €». Scena 2 (taglio secco): stessa inquadratura di pomeriggio, plafoniera bianca e fredda, muri vuoti. Lei: «Questa era la mia camera. Lo so.» Scena 3: piano medio, attacca la striscia dietro la testiera (inquadratura larga, niente dita in primo piano). Scena 4: appoggia la lampada sul comodino e la accende, il cerchio arancione compare sul muro. Scena 5: spegne la plafoniera, la stanza cambia di colpo, lei si butta sul letto: «Non esco più.» Scena 6: «Sono nel link, la lampada è quella del video.»",
    whyItWorks: "Il cervello fa il confronto da solo: non serve convincere, il salto visivo è la prova. Aprire sul dopo fa nascere il «come?» che tiene fino alla fine.",
    pitfalls: [
      "Prima e dopo con angolo, luce o distanza diversi: sembra truccato.",
      "Dopo non credibile per il prezzo (camera da rivista con una lampada da 20 €): sfiducia e resi.",
      "Processo saltato del tutto: senza vedere il prodotto all'opera non si capisce cosa si compra.",
      "Prima/dopo su pelle, peso o salute: claim rischiosi, spesso rifiutati dalle policy ads.",
      "Con l'AI il prodotto cambia forma o colore tra una scena e l'altra: stessa immagine di riferimento in tutte le scene.",
    ],
    badExample:
      "Il prima e il dopo generati come due stanze diverse (finestra spostata, letto diverso). Chi guarda se ne accorge in mezzo secondo e il video diventa la prova che il risultato è finto.",
  }),
  fmt({
    id: "testimonianza",
    name: "Testimonianza",
    when: "Quando il dubbio principale è «funziona davvero?». Per chi conosce già il problema o il prodotto e cerca conferme: è il format che converte di più chi è vicino all'acquisto. Va costruito sulle recensioni vere del brief, mai su risultati inventati.",
    awareness: ["problema", "soluzione", "prodotto"],
    bestFor: ["skincare e beauty", "comfort e benessere", "prodotti con tante recensioni vere"],
    duration: "20–40 s",
    beats: [
      { at: "0–2 s", part: "hook", name: "Confessione", what: "Risultato o situazione in prima persona, faccia in camera, ambiente vero (auto, bagno, letto)." },
      { at: "2–8 s", part: "buildup", name: "Lo scetticismo", what: "Cosa aveva provato prima e perché non ci credeva: l'obiezione dello spettatore detta da lei." },
      { at: "8–18 s", part: "buildup", name: "Il momento d'uso", what: "Quando, dove, cosa ha notato. Dettagli sensoriali, con il prodotto in uso." },
      { at: "18–26 s", part: "payoff", name: "Prova", what: "Il risultato mostrato, non solo detto, più una piccola imperfezione onesta che lo rende credibile." },
      { at: "26–30 s", part: "cta", name: "CTA personale", what: "«Se anche tu…, prova queste.» Tono da amica, non da commessa." },
    ],
    example:
      "Patch per brufoli. Scena 1: primo piano, bagno con luce del mattino, patch trasparente sul mento: «Colloquio alle 9. Ieri sera avevo un vulcano qui.» Scena 2: mezzo busto, seduta sul bordo della vasca: «Di solito lo schiaccio. E poi ho una macchia rossa per una settimana.» Scena 3: la sera prima, inquadratura frontale come se la camera fosse lo specchio, applica la patch con un gesto ampio. Scena 4: mattina, si toglie la patch verso la camera: la patch è diventata bianca, la pelle sotto è piatta e appena rosata. Scena 5: «Non è sparito del tutto. Ma col correttore non si vede, e non l'ho toccato.» Scena 6: «Sono queste, ormai le tengo in borsa.»",
    whyItWorks: "Parla da pari a pari, anticipa l'obiezione con la voce di chi l'aveva, e il dettaglio specifico (il colloquio alle 9) la rende vera. L'imperfezione ammessa vale più di dieci aggettivi.",
    pitfalls: [
      "Lista di aggettivi («lo adoro, è fantastico, lo consiglio») senza un momento concreto: non ci crede nessuno.",
      "Recitazione da spot: sorriso fisso, frasi perfette, sfondo da studio.",
      "Partire con «Ciao ragazzi, oggi vi parlo di…»: hook morto.",
      "Nessun risultato visibile: una testimonianza senza prova regge solo se chi parla è famoso.",
      "Personaggio AI presentato come cliente reale con risultati inventati: è una recensione falsa (vietata dalla FTC negli USA, pratica ingannevole in UE). Fai dire solo cose che le recensioni vere confermano, niente numeri inventati, e dichiara l'AI.",
    ],
    badExample:
      "«Ho perso 8 kg in 2 settimane con questa tisana, la consiglio a tutte!» detto da un avatar AI. Numero inventato, claim sulla salute, persona che non esiste: rischio rifiuto dell'ad, rischio legale e zero credibilità.",
  }),
  fmt({
    id: "confronto",
    name: "Confronto / test",
    when: "Quando il prodotto vince in modo VISIBILE su un'alternativa che lo spettatore conosce già (il metodo vecchio, il prodotto classico). Per chi sa che esistono soluzioni: il confronto risponde a «perché questo e non quello che ho già?». Funziona solo se allo spettatore importa chi vince.",
    awareness: ["soluzione", "prodotto"],
    bestFor: ["cucina", "pulizia", "gadget che sostituiscono un'abitudine", "drink e alimentari"],
    duration: "20–30 s",
    beats: [
      { at: "0–2 s", part: "hook", name: "Le due opzioni", what: "Affiancate, con la domanda chiara: chi vince su COSA («stessa cipolla: chi finisce prima e chi piange meno?»)." },
      { at: "2–6 s", part: "buildup", name: "Regole e posta", what: "Perché il risultato conta per chi guarda (tempo, lacrime, soldi, fatica). L'alternativa è presentata in modo onesto." },
      { at: "6–18 s", part: "buildup", name: "La gara", what: "Split screen o alternanza veloce, timer in montaggio, un momento in cui il metodo vecchio sembra cavarsela." },
      { at: "18–24 s", part: "payoff", name: "Verdetto visibile", what: "Risultato misurabile sul beneficio promesso, più un dettaglio che l'alternativa non può dare." },
      { at: "24–28 s", part: "cta", name: "CTA", what: "Dove prenderlo, con un'obiezione tolta (si lava in lavastoviglie, sta nel cassetto)." },
    ],
    example:
      "Tritatutto a cordino contro coltello. Scena 1: tavolo, due cipolle uguali, a sinistra un coltello, a destra il tritatutto. Lui: «Io col coltello, lei col tritatutto. Chi finisce prima, e chi piange.» Testo: «Coltello vs tritatutto». Scena 2: lui, sicuro: «Faccio il cuoco da sei anni.» (la posta: il suo orgoglio). Scena 3 split screen: lui taglia veloce sul tagliere; lei mette la cipolla tagliata a metà nel contenitore e tira il cordino cinque volte (piano medio, gesto ampio). Timer in montaggio. Scena 4: lui a metà, occhi lucidi, si asciuga con la manica. Scena 5: lei apre il coperchio verso la camera: trito fine e uniforme, timer fermo a 0:12. Scena 6: lui finisce a 0:58, occhi rossi: «Ok, ma il mio è più artigianale.» Scena 7: «È qui sotto. Si lava in lavastoviglie.»",
    whyItWorks: "Lo spettatore diventa giudice: due opzioni, una regola, un verdetto. Tifa perché la gara è sul fastidio che vive anche lui (piangere tagliando le cipolle), e il verdetto si vede sul timer e nel contenitore.",
    pitfalls: [
      "Il «test del mango»: un confronto che arriva dal nulla e non interessa a nessuno. Un personaggio beve un succo e di colpo fa «arancia vs mango» e dice «questo è mango vero». Fallisce perché: nessuno si era chiesto se fosse mango vero (nessuna domanda da chiudere); non c'è una transizione, è un salto; il verdetto è una frase, non una prova; non dimostra un beneficio che conti per chi guarda.",
      "Il fix del mango: prima fai nascere il dubbio («i succhi al mango del supermercato: guarda di che colore diventano allungati con l'acqua»), poi la prova visibile e affiancata, poi il beneficio (sapore, niente zucchero aggiunto) mostrato in faccia a chi assaggia.",
      "Alternativa sabotata (lui taglia apposta male): lo spettatore se ne accorge e smette di fidarsi.",
      "Confronto su una cosa che non interessa (velocità, quando il fastidio vero è lavare dopo).",
      "Troppe variabili: confronta UNA cosa, misurabile.",
      "Concorrenti nominati o col marchio in vista: rischio policy e legale. Usa «quello classico», «quello del supermercato».",
    ],
    badExample:
      "Ragazza al bar con un succo, taglio, ora ha un'arancia e un mango sul tavolo, assaggia e dice veloce «questo è mango vero». Nessun setup, nessuna posta, nessuna prova visibile, nessun motivo per cui allo spettatore dovrebbe importare: è la scena che Branko ha visto fallire.",
  }),
  fmt({
    id: "sfida",
    name: "Sfida",
    when: "Quando la promessa del prodotto si può mettere alla prova da una persona, in poco tempo, con un esito incerto. Funziona con traffico freddo perché intrattiene prima di vendere. Ottimo per fitness, gadget sportivi, prodotti «facili anche per chi è negato».",
    awareness: ["inconsapevole", "problema"],
    bestFor: ["fitness", "gadget sportivi", "abilità e giochi", "prodotti facili da usare"],
    duration: "20–35 s",
    beats: [
      { at: "0–2 s", part: "hook", name: "Sfida + posta", what: "La sfida in una frase e cosa succede se fallisce. Il personaggio è già in posizione." },
      { at: "2–6 s", part: "buildup", name: "Perché è difficile", what: "Il precedente andato male, meglio se mostrato (la crepa sul lampadario, il record da battere)." },
      { at: "6–20 s", part: "buildup", name: "Tentativo", what: "Con alti e bassi: almeno un momento in cui sembra fallire. Contatore in montaggio." },
      { at: "20–26 s", part: "payoff", name: "Esito", what: "Ce la fa GRAZIE al prodotto, e si vede perché. La vittoria dimostra il beneficio." },
      { at: "26–30 s", part: "cta", name: "CTA", what: "A chi serve («per chi vive in un monolocale come me»)." },
    ],
    example:
      "Corda per saltare senza fune, con contatore. Scena 1: salotto minuscolo, lampadario basso, lei con le due maniglie: «Cento salti in salotto. Se rompo qualcosa, paga mia sorella.» La sorella dal divano: «Andata.» Testo: «Sfida: 100 salti in 20 m²». Scena 2: fermo immagine di qualche mese fa, lampadario storto e una corda vera per terra: «L'ultima volta è finita così.» Scena 3: salta, piano intero, contatore in montaggio. Scena 4: a 60 si ferma col fiatone, la sorella ride: «Non ce la fai.» Scena 5: riparte, a 100 si butta sul divano. Dettaglio largo delle maniglie: nessuna fune, lampadario intatto. Scena 6: «Cento. Zero danni. E i salti li conta lei, io mi perdo.» Scena 7: «Link qui, per chi ha un monolocale come me.»",
    whyItWorks: "La domanda «ce la farà?» tiene incollati, la posta (paga la sorella, il lampadario) fa tifare. La vittoria non è della persona ma del prodotto: senza fune si può saltare in casa.",
    pitfalls: [
      "Sfida senza posta («faccio 50 squat»): e allora? Serve un motivo per tifare o per dubitare.",
      "Esito scontato dal primo secondo: niente tensione. Mostra almeno un momento di difficoltà.",
      "Il prodotto non c'entra con la vittoria: se avrebbe vinto anche senza, stai vendendo la persona.",
      "Sfide pericolose o di salute (diete, digiuni, resistenza estrema): limitate dalle policy e attirano commenti tossici.",
      "Risultati fisici lampo («30 giorni = addominali»): non credibili e spesso rifiutati.",
      "Il display del prodotto generato dall'AI mostra numeri sbagliati: inquadralo da lontano e metti il contatore in montaggio.",
    ],
    badExample:
      "«Sfida: uso la corda per 30 secondi!» Salta, finisce, sorride. Nessun rischio, nessun precedente, nessun legame con il vantaggio del prodotto (si può usare in casa): non c'è niente da guardare.",
  }),
  fmt({
    id: "tre_motivi",
    name: "3 motivi",
    when: "Per prodotti con più vantaggi reali e non ovvi, davanti a un pubblico che conosce già la categoria e deve scegliere. L'elenco numerato promette una fine chiara, e chi guarda resta per arrivare al terzo. Variante per chi sente il problema: «3 errori che fai con…».",
    awareness: ["soluzione", "prodotto"],
    bestFor: ["gadget tech", "accessori", "prodotti multiuso"],
    duration: "20–30 s",
    beats: [
      { at: "0–2 s", part: "hook", name: "Promessa numerata", what: "Specifica e con un'opinione forte («3 motivi per cui ho buttato tutti i cavi»). Prodotto già in uso." },
      { at: "2–9 s", part: "buildup", name: "Motivo 1", what: "Il più forte a livello visivo, dimostrato con un'azione." },
      { at: "9–16 s", part: "buildup", name: "Motivo 2", what: "Toglie un'obiezione (ingombro, durata, compatibilità)." },
      { at: "16–24 s", part: "payoff", name: "Motivo 3", what: "Il bonus inaspettato, quello che fa dire «non ci avevo pensato»." },
      { at: "24–28 s", part: "cta", name: "CTA", what: "Breve, con un consiglio da amico («prendine due»)." },
    ],
    example:
      "Power bank magnetico. Scena 1: lei cammina in stazione col telefono e il power bank attaccato dietro: «Tre motivi per cui non esco più senza.» Testo: «3 motivi (il terzo non me l'aspettavo)». Scena 2: lo avvicina al retro del telefono e si attacca da solo (inquadratura media, gesto semplice): «Uno: niente cavo. Lo attacchi e carica.» Scena 3: infila telefono e power bank nella tasca dei jeans: «Due: sta in tasca. Il mio vecchio pesava come un mattone.» Scena 4: serata con amici, una ha il telefono morto, lei lo stacca e glielo passa: «Tre: sono diventata la persona più amata del gruppo.» Scena 5: «Link sotto. Prendine due, fidati.»",
    whyItWorks: "La struttura è leggibile subito e promette una fine: chi guarda sa quanto manca. Ogni motivo è una mini prova, e il terzo, emotivo e inaspettato, è quello che resta in testa.",
    pitfalls: [
      "Motivi che sono specifiche tecniche («10.000 mAh, USB-C») invece di benefici vissuti.",
      "Tre motivi che dicono la stessa cosa in modi diversi.",
      "Il motivo più debole per ultimo: il payoff deve crescere, non spegnersi.",
      "Diventa un elenco letto: ogni motivo ha bisogno di una scena che lo mostra.",
      "Troppi motivi («7 motivi»): in 30 secondi non c'è spazio e chi scrolla sente la fatica.",
    ],
    badExample:
      "Talking head immobile che legge «uno: è potente, due: è compatto, tre: è di qualità». Tre aggettivi senza scene: nessuna prova, nessun motivo per arrivare in fondo.",
  }),
  fmt({
    id: "reazione",
    name: "Unboxing / reazione",
    when: "Per prodotti con un effetto wow immediato alla prima prova (regali, gadget, sensoriali, decor), o quando la reazione di una persona scettica vale come prova. Traffico freddo: si guarda per la reazione, si scopre il prodotto. Fortissimo nei periodi di regali.",
    awareness: ["inconsapevole", "prodotto"],
    bestFor: ["regali", "benessere e massaggio", "gadget", "decor"],
    duration: "15–30 s",
    beats: [
      { at: "0–2 s", part: "hook", name: "Chi reagisce e perché conta", what: "Flash della reazione al culmine, oppure il setup: «mio padre odia tutto ciò che ha una batteria»." },
      { at: "2–6 s", part: "buildup", name: "Aspettativa", what: "Il pacco, lo sguardo scettico, una battuta. Niente unboxing lento: si salta al momento d'uso." },
      { at: "6–15 s", part: "buildup", name: "Prima prova", what: "La reazione cambia davvero: dallo scetticismo al piacere, in piccoli segnali (braccia che si sciolgono)." },
      { at: "15–22 s", part: "payoff", name: "La frase che vale una recensione", what: "«Ok… dove l'hai preso?», con il prodotto ben visibile in uso." },
      { at: "22–26 s", part: "cta", name: "CTA", what: "Legata all'occasione («regalo di Natale risolto»)." },
    ],
    example:
      "Massaggiatore cervicale shiatsu. Scena 1 (flash forward): padre sui sessanta, occhi chiusi, testa all'indietro sul divano, massaggiatore sulle spalle: «…non lo tolgo.» Testo: «Mio padre odia i regali tecnologici». Scena 2: un'ora prima, gli dà la scatola, lui la guarda di traverso: «Un'altra cosa da caricare?» Scena 3: lei glielo appoggia sulle spalle (prodotto grande, presa semplice, inquadratura media). Lui rigido, braccia conserte. Scena 4: primo piano, le braccia si sciolgono, sospira. Scena 5: «Quanto l'hai pagato? …Prendine uno anche per tuo zio.» Scena 6: «Regalo di Natale risolto. Link qui.»",
    whyItWorks: "La reazione di uno scettico è una prova sociale in diretta: se convince lui, convince anche te. Il setup («odia la tecnologia») trasforma un semplice unboxing in una piccola sfida.",
    pitfalls: [
      "Reazione finta ed esagerata («OMG!!!» urlato): sa di spot, e con l'AI le espressioni esagerate sono le prime a sembrare innaturali.",
      "Unboxing lento (forbici, nastro, plastica): dieci secondi persi. Si taglia diretto al momento d'uso.",
      "Reazione a un oggetto che non fa niente di visibile: se il wow non si vede, chi guarda non lo sente.",
      "Nessun motivo per cui la reazione conta: «una ragazza apre un pacco» non è un hook, «mio padre che odia la tecnologia» sì.",
    ],
    badExample:
      "Mani che aprono una scatola su un tavolo bianco, tirano fuori il prodotto, lo girano davanti alla camera, musica di tendenza. Nessuna persona, nessuna reazione, nessuna prova: è il video del fornitore.",
  }),
  fmt({
    id: "pov",
    name: "POV",
    when: "Per prodotti legati a un momento riconoscibile o a un'identità («sei quella che…»). Funziona con traffico freddo perché la gente si ferma riconoscendosi nella scena, non cercando un prodotto. È il linguaggio più nativo di TikTok: sembra un contenuto, non un ad.",
    awareness: ["inconsapevole", "problema"],
    bestFor: ["lifestyle", "ufficio e studio", "cucina e pranzo fuori", "animali", "viaggi"],
    duration: "10–25 s",
    beats: [
      { at: "0–2 s", part: "hook", name: "POV specifico", what: "Testo «POV: …» con una situazione precisa e riconoscibile; l'immagine la mette in scena subito, spesso in soggettiva." },
      { at: "2–8 s", part: "buildup", name: "La scena vera", what: "Dettagli autentici di quel momento: colleghi, orari, sguardi, piccole frustrazioni." },
      { at: "8–16 s", part: "payoff", name: "Il prodotto cambia il finale", what: "È la parte naturale della scena che risolve, fa invidia o rende il momento migliore." },
      { at: "16–20 s", part: "cta", name: "CTA", what: "Morbida e complice («prima che lo scopra tutto il tuo ufficio»)." },
    ],
    example:
      "Scaldavivande elettrico da ufficio. Scena 1: testo «POV: sei l'unica in ufficio che a pranzo mangia caldo». Soggettiva sulla scrivania, 12:40, il contenitore attaccato alla presa con un filo di vapore. Scena 2: colleghi in fila davanti all'unico microonde, uno sbuffa guardando l'orologio. Scena 3: dall'alto, lei apre il coperchio: lasagna fumante. Scena 4: un collega si affaccia: «È caldo? Senza microonde?» Lei annuisce con la bocca piena. Scena 5: voce: «Lo attacco alle 11. Non faccio la fila da settembre.» Scena 6: «È nel link, prima che lo scopra tutto il tuo ufficio.»",
    whyItWorks: "Chi guarda si mette nei panni del protagonista in un secondo. Il prodotto non viene presentato: fa parte della scena, e il desiderio nasce dall'invidia dei colleghi.",
    pitfalls: [
      "POV generico («POV: ami il caffè»): nessuno si sente chiamato. Più è specifico, più persone si riconoscono.",
      "POV che non ha bisogno del prodotto: se togli il prodotto e la scena regge uguale, il prodotto è decorazione.",
      "Frase da spot infilata a metà («con il suo design ergonomico…»): rompe l'illusione.",
      "Testo «POV» generato dal modello dentro il video: va messo in montaggio.",
      "Citare un trend o un audio che fra un mese è vecchio: usa la struttura, non la citazione.",
    ],
    badExample:
      "«POV: hai trovato il prodotto perfetto», e poi la ragazza mostra il prodotto sorridendo. Non è un punto di vista, è uno showcase con la parola POV sopra.",
  }),
  fmt({
    id: "contrarian",
    name: "Contrarian",
    when: "Per mercati affollati, dove il pubblico ha già provato le soluzioni classiche ed è stanco (pulizia, animali, capelli, cucina). La frase controcorrente rompe l'abitudine e riapre l'attenzione. Si usa solo se dietro c'è un meccanismo vero che giustifica l'affermazione.",
    awareness: ["soluzione", "problema"],
    bestFor: ["animali", "pulizia", "cucina", "categorie sature"],
    duration: "20–35 s",
    beats: [
      { at: "0–2 s", part: "hook", name: "Affermazione controcorrente", what: "Contraddice una convinzione comune, detta con sicurezza e con la prova in vista." },
      { at: "2–8 s", part: "buildup", name: "Il perché", what: "Il meccanismo in parole semplici: cosa sbaglia la gente e cosa succede davvero." },
      { at: "8–12 s", part: "buildup", name: "Quindi", what: "Cosa serve davvero: il prodotto come conseguenza logica del meccanismo." },
      { at: "12–24 s", part: "payoff", name: "Dimostrazione", what: "Il nuovo modo funziona, e si vede la differenza con il vecchio." },
      { at: "24–28 s", part: "cta", name: "CTA", what: "Chiude il cerchio con l'immagine dell'hook." },
    ],
    example:
      "Tappeto olfattivo per cani. Scena 1: soggiorno, una cesta piena di giochi intatti, il cane sdraiato accanto che sbadiglia. Lei: «Smetti di comprare giochi al tuo cane. Guarda questa cesta.» Scena 2: «Non si annoia perché ha pochi giochi. Si annoia perché non deve mai cercare niente.» Testo: «Per un cane annusare è lavoro». Scena 3: nasconde crocchette tra le frange del tappeto (inquadratura larga, gesto ampio). Scena 4: il cane annusa, scava, coda che va. Jump cut con il timer in montaggio da 0:00 a 15:00. Scena 5: il cane dorme sopra il tappeto: «Quindici minuti a cercare, poi crolla. E il divano è ancora intero.» Scena 6: «Il tappeto è nel link. La cesta la regalo.»",
    whyItWorks: "Contraddire un'abitudine crea un piccolo fastidio («come sarebbe?») che si chiude solo restando. Se il meccanismo è vero e semplice, chi guarda esce con un'idea nuova e il prodotto ne è la conseguenza.",
    pitfalls: [
      "Provocazione senza meccanismo: clickbait, il pubblico si sente preso in giro e lo scrive nei commenti.",
      "Affermazioni false o pericolose per fare scalpore («la crema solare non serve»): policy e reputazione bruciate.",
      "Attaccare chi guarda («se fai così sei stupido»): difende la sua abitudine invece di ascoltare.",
      "Il prodotto non c'entra con il meccanismo spiegato.",
    ],
    badExample:
      "«Tutti sbagliano a pulire casa!» e poi parte una demo normale del mop, senza dire cosa sbagliano né perché. La promessa dell'hook non viene mantenuta.",
  }),
  fmt({
    id: "demo_asmr",
    name: "Demo / ASMR",
    when: "Per prodotti la cui azione è soddisfacente da vedere o sentire (rimuovere, tagliare, pulire, texture, ordine). Traffico freddo: si guarda per piacere e il prodotto si vende da solo mentre lavora. Ottimo come corpo fisso su cui testare hook parlati diversi.",
    awareness: ["inconsapevole", "problema"],
    bestFor: ["pulizia e cura dei tessuti", "cucina", "organizer", "beauty con texture"],
    duration: "10–25 s",
    beats: [
      { at: "0–2 s", part: "hook", name: "Il primo passaggio", what: "Macro sul punto «brutto» e il primo movimento del prodotto che lo sistema (la prima striscia pulita). Suono vero, niente musica sopra." },
      { at: "2–12 s", part: "buildup", name: "Progressione", what: "L'azione continua con avanzamento visibile, 3–4 angoli diversi (macro, medio, dall'alto)." },
      { at: "12–18 s", part: "payoff", name: "Risultato + residuo", what: "Il risultato completo e il «residuo» che soddisfa (lo sporco raccolto, la lana nel serbatoio)." },
      { at: "18–22 s", part: "cta", name: "CTA discreta", what: "Una riga e il testo. Non rompere l'atmosfera." },
    ],
    example:
      "Levapelucchi elettrico su un maglione. Scena 1: macro di un maglione grigio pieno di palline, la testina si appoggia, primo passaggio: una striscia liscia netta in mezzo ai pallini, ronzio del motore. Testo in montaggio: «aspetta la fine». Scena 2: dall'alto, altri passaggi: metà maglione nuovo, metà vecchio. Scena 3: dettaglio del serbatoio trasparente che si riempie di lanugine grigia. Scena 4: lei indossa il maglione e si gira verso la camera: sembra nuovo. Scena 5: svuota il serbatoio nel cestino, esce una nuvola di lana. Voce: «Era il maglione che stavo per buttare.» Testo: «Lo trovi qui sotto».",
    whyItWorks: "Il cervello vuole vedere finire il movimento iniziato (completamento) e premia la trasformazione con un piccolo piacere. Mentre si gode lo spettacolo, chi guarda ha già capito cosa fa il prodotto.",
    pitfalls: [
      "Musica sopra il suono vero: perdi tutto l'effetto ASMR.",
      "Progressione invisibile: se il prima e il dopo del passaggio non si distinguono a colpo d'occhio, non soddisfa.",
      "Troppo lungo senza variazioni: dopo tre passaggi uguali cambia angolo o vai al risultato.",
      "Con l'AI, la fisica (lanugine, schiuma, liquidi) è dove il modello sbaglia di più: se non è credibile, usa clip reali del fornitore per la demo e l'AI solo per il personaggio.",
      "Solo soddisfazione e nessun motivo per comprare: fa visualizzazioni, non vendite. Aggiungi una riga di contesto (il problema risolto).",
    ],
    badExample:
      "Il prodotto che gira su una superficie già pulita con musica lo-fi sopra. Niente trasformazione, niente suono vero: non c'è nulla di soddisfacente da guardare.",
  }),
  fmt({
    id: "storia",
    name: "Mini storia",
    when: "Per prodotti con un momento d'uso emotivo o un problema con conseguenze vere (viaggi, sicurezza, regali, animali, convivenza). Traffico freddo: si entra per la storia e si esce col prodotto. È il format più difficile: rende tantissimo con un conflitto vero, è il peggiore quando è una fila di scene senza tensione.",
    awareness: ["inconsapevole", "problema"],
    bestFor: ["viaggi", "sicurezza", "animali", "regali", "convivenza"],
    duration: "25–40 s",
    beats: [
      { at: "0–3 s", part: "hook", name: "In medias res", what: "Il momento peggiore, o una frase che apre un conflitto." },
      { at: "3–12 s", part: "buildup", name: "La situazione precipita", what: "2–3 scene legate da causa ed effetto, con un dettaglio specifico e umano." },
      { at: "12–18 s", part: "buildup", name: "Svolta", what: "Cosa ha cambiato le cose: il prodotto entra perché la storia lo richiede, non perché tocca a lui." },
      { at: "18–28 s", part: "payoff", name: "Stessa situazione, finale diverso", what: "La scena del problema rivissuta col prodotto: la differenza si vede." },
      { at: "28–32 s", part: "cta", name: "CTA", what: "Che richiama la storia." },
    ],
    example:
      "Localizzatore bluetooth per valigie. Scena 1: aeroporto, nastro bagagli vuoto, lei è l'ultima rimasta: «Barcellona, ore 23. La mia valigia non c'è.» Scena 2: all'ufficio bagagli l'impiegato alza le spalle: «Forse domani.» Scena 3: in hotel con la stessa maglietta: «Quattro giorni. Con una maglietta.» Scena 4: oggi, a casa, infila il localizzatore nella tasca interna della valigia (inquadratura media, gesto semplice): «Da allora viaggia con questo.» Scena 5: un altro aeroporto, lei guarda il telefono (la mappa si aggiunge in montaggio, non la genera il modello), poi alza lo sguardo e vede arrivare la sua valigia. Scena 6: «Adesso so sempre dov'è.» CTA: «Te lo lascio qui sotto. Costa meno di una maglietta dell'aeroporto.»",
    whyItWorks: "Una storia con un conflitto attiva il «come va a finire?», e lo spettatore vive il problema invece di sentirselo spiegare. Quando il prodotto arriva, è la risposta a una tensione che sente anche lui.",
    pitfalls: [
      "Storia senza conflitto («mi sveglio, colazione, uso il prodotto, sono felice»): vlog noioso.",
      "Salti logici: scene che non sono causa ed effetto, come il personaggio che all'improvviso fa un test che non c'entra (il «test del mango»). Chi guarda si perde e scrolla.",
      "Setup troppo lungo: se il conflitto arriva dopo 5 secondi, non lo vede nessuno.",
      "Il prodotto risolve qualcosa di diverso dal conflitto raccontato.",
      "Troppi personaggi o luoghi: con l'AI ogni personaggio in più è un rischio di incoerenza. Massimo 2 personaggi e 2–3 luoghi.",
      "Spacciare per «storia vera» una storia scritta e girata con l'AI: è ingannevole.",
    ],
    badExample:
      "Una ragazza beve un succo al parco, poi è in cucina, poi fa un test arancia contro mango, poi sorride in camera. Quattro scene senza un problema, senza una causa che le leghi e senza un finale: non è una storia, è un collage.",
  }),
  fmt({
    id: "esperimento",
    name: "Esperimento",
    when: "Quando la promessa principale è misurabile e si dimostra con un test semplice, ripetibile e visibile (isolamento, resistenza, durata, impermeabilità, assorbimento). Per un pubblico scettico che conosce la soluzione o il prodotto: l'esperimento sostituisce il «fidati». A differenza del confronto, la domanda è «regge la promessa?», non «chi vince?».",
    awareness: ["soluzione", "prodotto"],
    bestFor: ["drink e borracce", "outdoor", "prodotti resistenti o impermeabili", "pulizia"],
    duration: "20–35 s",
    beats: [
      { at: "0–2 s", part: "hook", name: "Ipotesi", what: "Domanda con una condizione estrema ma realistica: «Ghiaccio alle 8, auto al sole fino alle 18. Cosa trovo?»" },
      { at: "2–6 s", part: "buildup", name: "Perché importa + setup", what: "Il fallimento che tutti conoscono, e un setup chiaro e onesto, possibilmente con un controllo (la bottiglia normale)." },
      { at: "6–14 s", part: "buildup", name: "Il tempo passa", what: "Jump cut con orari, luce che cambia, un momento di dubbio («qui ho paura»)." },
      { at: "14–22 s", part: "payoff", name: "Il momento della verità", what: "Mostrato e sentito, con il controllo accanto per contrasto. Il risultato è quello che il prodotto fa davvero." },
      { at: "22–26 s", part: "cta", name: "CTA", what: "Breve, con una variante utile (formato, colore)." },
    ],
    example:
      "Borraccia termica. Scena 1: mattina, lei con la borraccia e una bottiglietta di plastica, tutte e due già piene di ghiaccio (inquadratura larga): «Ghiaccio alle 8. Le lascio in macchina al sole fino alle 18.» Testo: «Agosto, auto sotto il sole». Scena 2: le appoggia sul cruscotto, il sole picchia sul vetro: «Perché ogni estate bevo acqua calda come il tè.» Scena 3: jump cut, testo «13:00», lei apre la portiera e si fa aria con la mano. Scena 4: 18:00, la bottiglietta: acqua tiepida versata sulla mano: «Brodo.» Scena 5: scuote la borraccia vicino al microfono, si sente il ghiaccio; versa in un bicchiere, escono i cubetti. Scena 6: beve, sollievo: «Dieci ore. C'è ancora il ghiaccio.» CTA: «Link sotto, c'è anche da un litro.» (Prima di scriverlo, verifica che il prodotto vero regga davvero.)",
    whyItWorks: "Trasforma una promessa in una domanda con una risposta che si vede e si sente. Il controllo accanto (la bottiglietta) dà il metro di paragone, e il tempo che passa crea suspense senza bisogno di una storia.",
    pitfalls: [
      "Esperimento che nessuno ha chiesto: misurare qualcosa che non interessa (il «test del mango» in versione scientifica). Il test deve rispondere al dubbio vero di chi compra.",
      "Condizioni truccate o così estreme da sembrare finte: l'esperimento vale solo se è credibile.",
      "Risultato inventato: il payoff deve corrispondere a quello che il prodotto fa davvero. Un video che promette 10 ore quando ne regge 4 porta resi e commenti negativi.",
      "Nessun controllo: senza la bottiglia normale accanto, «c'è ancora ghiaccio» non dice niente.",
      "Tempo che passa senza segnali: usa orari, luce che cambia, termometro (aggiunti in montaggio).",
    ],
    badExample:
      "«Testiamo se è impermeabile!» e la versa sotto il rubinetto per un secondo. Nessuna condizione realistica, nessun controllo, nessuna tensione: non dimostra niente che lo spettatore si chiedesse.",
  }),
];

/* ------------------------------------------------------------------ */
/* Tipi di hook                                                        */
/* ------------------------------------------------------------------ */

// Regola valida per tutti: l'hook è quello che si VEDE, si SENTE e si LEGGE nei primi 1–2 secondi.
// Le tre cose dicono la stessa promessa; il primo fotogramma deve funzionare anche a volume zero.

export const HOOK_TYPES: HookType[] = [
  {
    id: "problema",
    name: "Problema",
    why: "Riconoscimento immediato: «questo sono io». Il cervello presta attenzione a ciò che lo riguarda, e il problema detto con le parole giuste filtra da solo il pubblico giusto (chi non ce l'ha scrolla, ed è un bene).",
    firstFrame: "Il problema in azione e ben visibile (fughe nere, peli sul divano, collo bloccato), con una faccia che lo vive, non che lo spiega.",
    examples: [
      "«Se anche il tuo gatto lascia più peli sul divano che su se stesso, guarda.»",
      "«Nessuno mi aveva detto che le fughe del bagno diventano nere così.»",
      "«Ho 28 anni e la cervicale di mia nonna.»",
      "«Ogni mattina: phon, piastra, e alle 10 sono già crespi.»",
    ],
    pairsWith: ["problema_soluzione", "testimonianza", "prima_dopo"],
    avoid: "Problema vago («odi le pulizie?») o detto da un viso sorridente: senza fastidio visibile non c'è riconoscimento.",
  },
  {
    id: "contrarian",
    name: "Contrarian",
    why: "Contraddire una convinzione crea dissonanza: chi guarda resta per capire se ha sbagliato finora o per dare torto a chi parla. In tutti e due i casi resta. Funziona solo se poi arriva un perché vero.",
    firstFrame: "Chi parla guarda dritto in camera, sicuro, con la «prova» dell'abitudine sbagliata in vista (la cesta di giochi intatti, lo sgrassatore).",
    examples: [
      "«Smetti di comprare giochi al tuo cane. Non è quello che gli manca.»",
      "«Il problema non è il tuo forno. È come lo pulisci.»",
      "«Il frullatore che hai in cucina è il motivo per cui non fai mai i frullati.»",
      "«Lo spazzolino per le fughe è la cosa più lenta che tu possa usare.»",
    ],
    pairsWith: ["contrarian", "confronto", "tre_motivi"],
    avoid: "Provocare senza spiegare, o dire cose false e rischiose per fare scalpore: clickbait, commenti arrabbiati, ad rifiutati.",
  },
  {
    id: "curiosita",
    name: "Curiosità",
    why: "Il curiosity gap: quando manca un pezzo di informazione, il cervello lo sente come un prurito e resta per chiuderlo. Va chiuso con un payoff all'altezza, altrimenti chi guarda si sente fregato.",
    firstFrame: "Un oggetto strano o un gesto che non si capisce, in primo piano, già in movimento.",
    examples: [
      "«Non capivo perché mia suocera tenesse questa cosa nel cassetto. Poi l'ho provata.»",
      "«Guarda cosa succede quando lo metto sotto l'acqua.»",
      "«Ho scoperto perché negli hotel le lenzuola sono sempre così.»",
      "«Questo costa meno di un caffè e mi ha fatto risparmiare un'ora a settimana.»",
    ],
    pairsWith: ["demo_asmr", "esperimento", "storia", "contrarian"],
    avoid: "Mistero che si risolve in qualcosa di banale, o che viene svelato dopo 15 secondi: la gente se ne va prima.",
  },
  {
    id: "risultato",
    name: "Risultato",
    why: "Mostrare la fine all'inizio accende il desiderio («lo voglio») e la domanda («come?»). Chi guarda resta per scoprire il percorso. È l'hook più diretto per le trasformazioni visibili.",
    firstFrame: "Il dopo, bello e chiaro: la camera trasformata, il maglione nuovo, il divano senza un pelo. Spesso con un taglio secco al prima nel secondo successivo.",
    examples: [
      "«Questa è la mia camera. Venti minuti fa era così.»",
      "«Il maglione che stavo per buttare. Adesso.»",
      "«Zero peli sul divano. E il gatto vive ancora qui.»",
      "«Tre settimane fa non riuscivo a fare dieci salti di fila.»",
    ],
    pairsWith: ["prima_dopo", "testimonianza", "demo_asmr"],
    avoid: "Risultato troppo bello per essere vero, o che il prodotto non dà davvero: alto hook rate, poi resi e commenti «truffa».",
  },
  {
    id: "prova_sociale",
    name: "Prova sociale",
    why: "Se lo usano persone come me, probabilmente funziona (riprova sociale), e se lo hanno tutti non voglio restare fuori. Su TikTok funziona quando è concreta e di vicinato («mia madre», «tutto l'ufficio»), non quando è un numero da sito.",
    firstFrame: "Più persone con lo stesso prodotto, o un commento vero sovrapposto in montaggio (lo screenshot non va generato dal modello).",
    examples: [
      "«L'ha comprato mia sorella, poi mia madre. Adesso tocca a me vedere se è vero.»",
      "«Tutto il mio ufficio ora ha questa cosa sulla scrivania. È colpa mia.»",
      "«Rispondo alla domanda che mi fate di più: sì, funziona anche sul pelo lungo.»",
      "«Mio padre non consiglia mai niente. Questo l'ha regalato a tre amici.»",
    ],
    pairsWith: ["testimonianza", "reazione", "tre_motivi"],
    avoid: "Inventare numeri, recensioni o commenti: è una recensione falsa (vietata) e i commenti veri ti sbugiardano. Usa solo le prove reali del brief.",
  },
  {
    id: "pov",
    name: "POV / scenario",
    why: "Mette lo spettatore dentro la scena: non guarda qualcuno, è qualcuno. Identificazione immediata, e il linguaggio è così nativo che il cervello non lo cataloga come pubblicità.",
    firstFrame: "Soggettiva o scena già in corso, con il testo «POV: …» aggiunto in montaggio. Situazione precisa: ora, luogo, persone.",
    examples: [
      "«POV: sei l'unica in ufficio che a pranzo mangia caldo.»",
      "«POV: tuo padre, che odia la tecnologia, apre il tuo regalo.»",
      "«POV: hai capito perché il tuo cane distrugge i cuscini.»",
      "«POV: torni a casa dopo una giornata infinita e la camera ti accoglie così.»",
    ],
    pairsWith: ["pov", "reazione", "storia"],
    avoid: "POV generici («POV: ami lo shopping») o POV dove il prodotto è solo decorazione.",
  },
  {
    id: "domanda",
    name: "Domanda diretta",
    why: "Una domanda a cui rispondi «sì» nella tua testa è un micro-impegno: ti sei già selezionato come pubblico e vuoi sentire il resto. Deve essere specifica e da sì o no.",
    firstFrame: "Chi parla guarda in camera e indica o mostra la cosa di cui parla; la domanda è anche a schermo.",
    examples: [
      "«Anche tu ti svegli con il collo bloccato?»",
      "«Quanti caricabatterie hai perso quest'anno?»",
      "«Il tuo cane ti fissa mentre lavori? Non è amore, è noia.»",
      "«Lo sapevi che puoi saltare la corda in salotto senza rompere niente?»",
    ],
    pairsWith: ["problema_soluzione", "contrarian", "tre_motivi"],
    avoid: "Domande generiche o retoriche («vuoi una pelle perfetta?», «ti piace risparmiare?»): la risposta in testa è «boh», e si scrolla.",
  },
  {
    id: "shock_visivo",
    name: "Interruzione visiva",
    why: "Il feed è una sequenza prevedibile; un movimento, un contrasto o un gesto inatteso rompe lo schema e il cervello guarda prima ancora di decidere (pattern interrupt). Lo stesso testo con un primo fotogramma diverso rende in modo diverso.",
    firstFrame: "Un'azione fisica inattesa e legata al prodotto: versare caffè sulla tovaglia bianca, rovesciare un sacchetto di peli sul divano, tagliare il prodotto a metà, un punch-in improvviso sul dettaglio.",
    examples: [
      "(rovescia caffè sulla tovaglia bianca, poi guarda in camera) «Tranquilli. Guardate.»",
      "(punch-in su un maglione pieno di palline, la prima striscia liscia) «Aspetta.»",
      "(lascia cadere il telefono con la cover sul pavimento di casa) «Era il terzo schermo quest'anno. Era.»",
      "(apre l'auto rovente e ne tira fuori una borraccia che tintinna) «Dieci ore al sole.»",
    ],
    pairsWith: ["demo_asmr", "esperimento", "prima_dopo"],
    avoid: "Shock gratuito slegato dal prodotto: hook rate alto, vendite zero, e pubblico sbagliato. Anche gesti complicati che l'AI non sa rendere (oggetti che volano, liquidi in slow motion).",
  },
  {
    id: "sfida",
    name: "Sfida",
    why: "«Ce la farà?» è una domanda aperta con un esito incerto: suspense pura. Se c'è una posta in gioco (soldi, orgoglio, una scommessa) chi guarda si schiera e resta per vedere chi ha ragione.",
    firstFrame: "Il personaggio già in posizione, con l'ostacolo in vista (il lampadario basso, il cronometro, lo scettico a braccia conserte).",
    examples: [
      "«Cento salti in salotto. Se rompo qualcosa, paga mia sorella.»",
      "«Ho sessanta secondi per togliere i peli dal divano prima che arrivi mia suocera.»",
      "«Mio padre dice che è una cavolata. Gli do cinque minuti per cambiare idea.»",
      "«Ghiaccio alle 8, auto sotto il sole. Apro alle 18.»",
    ],
    pairsWith: ["sfida", "esperimento", "reazione", "confronto"],
    avoid: "Sfida senza posta o con esito scontato, o una sfida che si vince anche senza il prodotto.",
  },
  {
    id: "storia",
    name: "Inizio di storia",
    why: "Partire nel mezzo di un conflitto (in medias res) attiva il bisogno di sapere come va a finire. Il cervello si lascia trasportare dalle storie e abbassa la guardia verso la pubblicità.",
    firstFrame: "Il momento peggiore della storia, già in corso: il nastro bagagli vuoto, il divano distrutto, il biglietto arrabbiato sul frigo.",
    examples: [
      "«Il giorno che ho perso la valigia a Barcellona ho giurato: mai più.»",
      "«L'anno scorso il mio cane ha mangiato un divano. Letteralmente.»",
      "«La mia coinquilina mi ha lasciato un biglietto sul frigo. Parlava dei miei capelli nel lavandino.»",
      "«L'ho comprato per scherzo. Due settimane dopo l'ho regalato a tutta la famiglia.»",
    ],
    pairsWith: ["storia", "testimonianza", "pov"],
    avoid: "Iniziare dall'inizio («allora, tutto è cominciato quando…»): il conflitto deve arrivare nella prima frase, non dopo cinque secondi.",
  },
  {
    id: "confronto",
    name: "Confronto",
    why: "Due cose affiancate e il cervello giudica da solo, in automatico. Lo split screen si capisce anche muto e in mezzo secondo, e fa nascere subito la domanda «quale vince?».",
    firstFrame: "Split screen o due oggetti uguali uno accanto all'altro, con la regola del confronto in testo.",
    examples: [
      "«Coltello contro tritatutto. Stessa cipolla. Via.»",
      "«Borraccia normale contro termica, tutte e due al sole per dieci ore.»",
      "«Il mio vecchio caricabatterie contro questo, per una giornata intera.»",
      "«Spazzolino contro spazzola elettrica: metà fuga a testa.»",
    ],
    pairsWith: ["confronto", "esperimento", "prima_dopo"],
    avoid: "Confrontare cose di cui allo spettatore non importa (il «test del mango»), o marchi concorrenti nominati.",
  },
  {
    id: "asmr",
    name: "Sensoriale / ASMR",
    why: "Suoni e texture soddisfacenti danno un piacere immediato, e il bisogno di vedere finire un movimento iniziato tiene fino alla fine. Il visivo deve reggere anche muto; col suono rende ancora di più.",
    firstFrame: "Macro su una texture (lana, schiuma, sporco, ghiaccio) e il primo movimento del prodotto che inizia a trasformarla. Suono vero, niente musica.",
    examples: [
      "(nessuna voce, solo il ronzio) testo: «aspetta la fine»",
      "«Sentite questo suono.»",
      "«Non dico niente. Guardate.»",
      "«Il suono più soddisfacente della mia settimana.»",
    ],
    pairsWith: ["demo_asmr", "prima_dopo", "esperimento"],
    avoid: "Musica di tendenza sopra il suono vero, o una «trasformazione» così lenta che non si vede.",
  },
];

/* ------------------------------------------------------------------ */
/* Principi di gusto                                                   */
/* ------------------------------------------------------------------ */

/** Il "gusto": regole pratiche che separano un ad che ferma lo scroll da uno showcase noioso. */
export const PRINCIPLES: { title: string; text: string }[] = [
  {
    title: "Il prodotto è la risposta, non la domanda",
    text: "Prima fai nascere la domanda (un problema, un desiderio, una curiosità), poi arriva il prodotto. Uno showcase risponde a una domanda che nessuno ha fatto.",
  },
  {
    title: "Due secondi per un motivo",
    text: "Entro 2 secondi chi guarda deve pensare «questo sono io» o «voglio vedere come finisce». Se non scatta nessuna delle due, scrolla, e il resto del video non esiste.",
  },
  {
    title: "Hook = immagine + voce + testo",
    text: "I primi 1–2 secondi si vedono, si sentono e si leggono: le tre cose dicono la stessa promessa. Il primo fotogramma deve funzionare a volume zero. Niente logo, niente saluti, niente intro.",
  },
  {
    title: "Mostra, non dire",
    text: "«È potentissimo» non vale niente; vedere la fuga nera diventare bianca sì. Ogni beneficio importante ha una scena che lo dimostra.",
  },
  {
    title: "Specifico batte generico",
    text: "«I peli del gatto sul divano nero il giorno che arriva mia suocera» batte «elimina i peli». Dettagli concreti (un'ora, un luogo, una persona) rendono credibile e fanno riconoscere.",
  },
  {
    title: "Niente posta in gioco, niente tensione",
    text: "Un test o una sfida funzionano solo se chi guarda tiene all'esito: prima fai temere o desiderare il risultato, poi mostralo. Un «arancia vs mango» che nessuno si era chiesto è rumore.",
  },
  {
    title: "Il payoff atterra sul beneficio",
    text: "La prova finale dimostra la cosa per cui si compra il prodotto, non un dettaglio qualsiasi. Il momento migliore del video e il motivo d'acquisto devono coincidere.",
  },
  {
    title: "Causa ed effetto, niente salti",
    text: "Ogni scena è la conseguenza naturale della precedente. Se per capire perché succede qualcosa serve una spiegazione, la storia è rotta.",
  },
  {
    title: "Un'idea per video",
    text: "Un pubblico, un problema, una promessa, una prova. Tre benefici in 20 secondi sono zero benefici ricordati: gli altri vanno in altri video.",
  },
  {
    title: "Nativo prima che bello",
    text: "Deve sembrare il video di una persona, non uno spot: telefono, luce vera, casa vissuta, linguaggio parlato. Nativo non vuol dire sciatto: volto e prodotto si vedono bene.",
  },
  {
    title: "Parla come il cliente",
    text: "Usa le parole delle recensioni e dei commenti (la «voce cliente» del brief), non quelle della scheda prodotto. «Mi si incastrava il cavo ovunque» vende, «design wireless innovativo» no.",
  },
  {
    title: "Il ritmo è rispetto",
    text: "Ogni 1,5–3 secondi cambia qualcosa: inquadratura, informazione, azione. Taglia tutto ciò che non fa avanzare la storia, comprese le pause tra le battute.",
  },
  {
    title: "Credibile batte esagerato",
    text: "Le promesse gonfiate accendono lo scetticismo (e i resi); un risultato realistico che si vede convince di più. Anticipa l'obiezione principale invece di nasconderla.",
  },
  {
    title: "CTA che segue la storia",
    text: "Dopo il payoff, di' cosa fare e perché adesso (offerta, garanzia, accessorio). Per vendere serve una CTA chiara e diretta; quella morbida va bene solo per i video di puro intrattenimento.",
  },
  {
    title: "L'hook si testa, il corpo si tiene",
    text: "Stesso corpo, 3–5 hook diversi: si cambia una cosa sola e si capisce cosa funziona. Quando un vincente si stanca, cambia angolo o format, non solo il colore del testo.",
  },
];

/* ------------------------------------------------------------------ */
/* Griglia del critico                                                 */
/* ------------------------------------------------------------------ */

/** Griglia del critico: domande a cui rispondere prima di approvare (peso = quanto conta sul voto). */
export type RubricItem = {
  id: string;
  question: string;
  weight: number;
  stage: "gate" | "revisione" | "entrambi";
  /** Se la risposta è "no" il verdetto non può essere "approvato", qualunque sia il voto. */
  critical?: boolean;
  /** Com'è un sì. */
  pass?: string;
  /** Segnali di un no. */
  fail?: string;
};

// Pesi: per ogni fase le domande della fase + quelle "entrambi" sommano 10.
// gate = 6.5 (entrambi) + 3.5 (gate) · revisione = 6.5 (entrambi) + 3.5 (revisione).
export const REVIEW_RUBRIC: RubricItem[] = [
  {
    id: "primi_2s",
    question: "Nei primi 2 secondi c'è un motivo per restare?",
    weight: 2,
    stage: "entrambi",
    critical: true,
    pass: "Immagine, battuta e testo dicono la stessa promessa; il primo fotogramma funziona anche muto; si capisce subito di cosa parla e per chi.",
    fail: "Intro, saluti, logo, confezione chiusa, una persona che sorride senza dire niente di specifico, un primo fotogramma statico.",
  },
  {
    id: "perche_importa",
    question: "Lo spettatore capisce perché gli dovrebbe importare?",
    weight: 1.5,
    stage: "entrambi",
    pass: "C'è un problema, un desiderio o una posta in gioco che chi guarda vive davvero, detti con le parole del cliente.",
    fail: "Il video parla del prodotto o del brand, non di chi guarda. Test o sfide senza motivo («arancia vs mango» dal nulla).",
  },
  {
    id: "payoff_beneficio",
    question: "Il payoff dimostra il beneficio del prodotto, non solo il prodotto?",
    weight: 1.5,
    stage: "entrambi",
    critical: true,
    pass: "Il momento clou mostra il risultato per cui si compra (fuga bianca, ghiaccio dopo 10 ore, trito in 12 secondi), in modo visibile.",
    fail: "Il prodotto appare e viene descritto, ma niente lo dimostra; oppure la prova riguarda un dettaglio che a nessuno interessa.",
  },
  {
    id: "nativo",
    question: "Sembra un contenuto nativo o una pubblicità?",
    weight: 1,
    stage: "entrambi",
    pass: "Sembra il video di una persona vera: linguaggio parlato, luce e luoghi credibili, ritmo da feed.",
    fail: "Frasi da scheda prodotto, sorrisi da spot, sfondo da studio, musica da televendita, «il nostro prodotto».",
  },
  {
    id: "onesta",
    question: "Promesse vere e dichiarabili, nessuna persona o recensione inventata spacciata per vera, AI dichiarata?",
    weight: 0.5,
    stage: "entrambi",
    critical: true,
    pass: "I claim sono quelli che il prodotto mantiene (prove del brief); nessun numero inventato; niente salute o risultati corporei miracolosi; etichetta AI prevista.",
    fail: "«Ho perso 8 kg», «migliaia di clienti» senza prova, finto cliente con risultati inventati, marchi concorrenti nominati.",
  },
  {
    id: "format_giusto",
    question: "Il format è quello giusto per il prodotto e per quanto sa già il pubblico?",
    weight: 1,
    stage: "gate",
    pass: "Il format scelto corrisponde al livello di consapevolezza (es. traffico freddo: problema → soluzione, POV, demo; scettici: esperimento, testimonianza).",
    fail: "Un elenco di caratteristiche per chi non sa nemmeno di avere il problema; una mini storia per un prodotto che si capisce in 3 secondi di demo.",
  },
  {
    id: "logica_storia",
    question: "La storia regge? Ogni scena causa la successiva, senza salti?",
    weight: 1,
    stage: "gate",
    critical: true,
    pass: "Si riassume in una frase (hook → build-up → payoff → CTA) e ogni scena ha un compito. Togliendone una, la storia si rompe.",
    fail: "Scene messe in fila senza causa ed effetto, svolte che arrivano dal nulla, un test che non c'entra con quanto mostrato prima.",
  },
  {
    id: "specificita",
    question: "C'è almeno un dettaglio specifico e credibile al posto delle frasi generiche?",
    weight: 0.5,
    stage: "gate",
    pass: "Un'ora, un luogo, una persona, un numero vero, un'obiezione precisa («colloquio alle 9», «monolocale da 20 m²»).",
    fail: "«Pratico, innovativo, di qualità», «rivoluzionerà la tua vita», «perfetto per tutti».",
  },
  {
    id: "producibile",
    question: "Si può girare bene con il generatore video?",
    weight: 1,
    stage: "gate",
    pass: "Scene da 2–5 s con una sola azione, max 2 personaggi, battute brevi, prodotto inquadrato in modo semplice, testi previsti in montaggio.",
    fail: "Mani che manipolano oggetti piccoli in primo piano, folle, specchi, liquidi complicati, frasi lunghe con numeri, testo da generare nel video.",
  },
  {
    id: "tecnica_ai",
    question: "Mani, corpi, volti, labiale e prodotto sono credibili e fedeli?",
    weight: 2,
    stage: "revisione",
    critical: true,
    pass: "Nessuna deformazione; il prodotto ha forma, colori e logo giusti in ogni scena; il personaggio è lo stesso dall'inizio alla fine; il labiale va a tempo.",
    fail: "Dita in più o fuse, oggetti che si trasformano, prodotto diverso da quello vero, faccia che cambia tra le scene, bocca fuori sincrono.",
  },
  {
    id: "leggibile_audio",
    question: "Si capisce tutto a volume zero, e con il volume l'audio è pulito?",
    weight: 0.75,
    stage: "revisione",
    pass: "Sottotitoli e testi leggibili, corretti, dentro le zone sicure (non coperti dall'interfaccia); voce chiara, musica sotto la voce.",
    fail: "Testi minuscoli, con errori, sotto i pulsanti o nella fascia della descrizione; musica che copre la voce; audio metallico.",
  },
  {
    id: "ritmo",
    question: "Il ritmo tiene, senza punti morti, e la durata è giusta?",
    weight: 0.75,
    stage: "revisione",
    pass: "Qualcosa cambia ogni 1,5–3 s, nessuna pausa inutile, il payoff arriva prima che cali l'attenzione, la CTA è chiara.",
    fail: "Inquadrature ferme per 5 secondi, silenzi tra le battute, intro lunga, finale che si trascina dopo il payoff.",
  },
];

/** Come trasformare la griglia in un verdetto. */
export const VERDICT_RULES: string[] = [
  "Per ogni domanda della fase (le sue + quelle «entrambi») rispondi 1 = sì, 0,5 = in parte, 0 = no. Voto = somma di risposta × peso, su 10 (rubricScore lo calcola).",
  "Approvato: voto 7,5 o più e nessuna domanda critica a 0.",
  "Da rifare: voto tra 5 e 7,4, oppure una domanda critica a 0 ma l'idea ha un nucleo buono.",
  "Scartato: voto sotto 5, oppure nessun motivo per guardarlo nemmeno riscrivendo l'hook.",
  "scrollStop è true solo se «primi_2s» vale 1.",
  "Ogni correzione dice COSA cambiare e COME: non «migliora l'hook», ma «apri sul gatto che si strofina sul divano nero, non sulla scatola».",
  "Al gate, nel dubbio tra approvato e da rifare, scegli da rifare: riscrivere costa poco, produrre costa tanto.",
];

/** Le domande della griglia che valgono per una fase. */
export const rubricFor = (stage: "gate" | "revisione") => REVIEW_RUBRIC.filter((r) => r.stage === stage || r.stage === "entrambi");

/**
 * Voto 1–10 da risposte 0 / 0,5 / 1 per id di domanda.
 * `criticalFails`: domande critiche a 0 (blocca "approvato"). `missing`: domande senza risposta (contano 0).
 */
export function rubricScore(stage: "gate" | "revisione", answers: Record<string, number>) {
  const items = rubricFor(stage);
  let total = 0;
  const criticalFails: string[] = [];
  const missing: string[] = [];
  for (const item of items) {
    const raw = answers[item.id];
    if (typeof raw !== "number" || Number.isNaN(raw)) {
      missing.push(item.id);
      if (item.critical) criticalFails.push(item.id);
      continue;
    }
    const v = Math.max(0, Math.min(1, raw));
    total += item.weight * v;
    if (item.critical && v === 0) criticalFails.push(item.id);
  }
  return { score: Math.max(1, Math.round(total * 10) / 10), criticalFails, missing };
}

/* ------------------------------------------------------------------ */
/* Regole per gli script                                               */
/* ------------------------------------------------------------------ */

/** Regole per scrivere script che l'AI riesce a girare bene (scene, battute, labiale). */
export const SCRIPT_RULES: string[] = [
  "Una scena = 2–5 secondi = una sola azione. Il generatore è stabile su clip corte; un'azione complessa si spezza in due scene, non si allunga.",
  "Scrivi l'inquadratura in modo esplicito: tipo (primo piano, mezzo busto, piano intero, dettaglio, soggettiva), angolo, camera fissa o a mano, luce. Sempre verticale 9:16.",
  "Battute corte: una frase per scena, al massimo 8–10 parole (circa 3 secondi). Il labiale si rompe sulle frasi lunghe.",
  "Niente numeri difficili, sigle o parole straniere nelle battute: «la metà del tempo», non «il 47,5% in meno». I numeri vanno nel testo a schermo.",
  "Personaggio coerente: stessa immagine di riferimento in ogni scena, e la stessa descrizione (età, capelli, vestiti, luogo) copiata identica in ogni prompt. Massimo 2 personaggi.",
  "Prodotto fedele: usa la foto del prodotto vero come riferimento in ogni scena dove compare; inquadralo intero, fermo o con una presa semplice.",
  "Niente mani che manipolano oggetti piccoli in primo piano (svitare, premere tasti minuscoli, aprire bustine). Allarga l'inquadratura, taglia sul prima e sul dopo, o usa una clip reale del fornitore.",
  "Mai testo generato dal modello: scritte, sottotitoli, schermate di telefono, etichette leggibili vanno nel campo onScreen e si aggiungono in montaggio. Se il logo esce deformato, inquadra il prodotto di lato.",
  "Fisica semplice: evita liquidi versati, oggetti che volano, specchi, folle, trasformazioni a vista. Inquadra il risultato, non il processo complicato.",
  "La scena 1 è l'hook già in movimento: niente intro, saluti o logo. Deve funzionare da sola e a volume zero; scrivine 3 o più versioni che si attaccano alla stessa scena 2.",
  "Scrivi per il suono spento: ogni battuta ha il suo sottotitolo, l'informazione chiave anche nel testo a schermo, l'azione racconta da sola.",
  "Ritmo in montaggio: un cambio ogni 1,5–3 secondi (nuova inquadratura, punch-in, cambio d'angolo). Durata per il traffico freddo 15–35 s, di solito 20–30.",
  "Ogni scena ha un compito (hook, build-up, payoff o CTA). Se togliendola la storia regge, toglila.",
  "La scena del payoff è la più curata: luce pulita, prodotto riconoscibile, risultato visibile (non detto), inquadratura stabile.",
  "Look da telefono, non da spot: luce naturale, camera a mano leggera, ambienti veri e un po' vissuti. Su TikTok l'annuncio va dichiarato come contenuto AI in Ads Manager, e nessun personaggio AI va presentato come cliente reale con risultati inventati.",
];

export const formatOf = (id: string) => FORMATS.find((f) => f.id === id);
export const hookTypeOf = (id: string) => HOOK_TYPES.find((h) => h.id === id);

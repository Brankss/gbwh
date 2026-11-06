// Classifiche dei modelli AI: tipi e definizioni condivisi tra server e client.

export type ModelKind = "llm" | "image" | "video";

export type Benchmark = {
  key: string;
  label: string;
  unit: "%" | "punti" | "elo" | "$/1M" | "tok/s";
  higherIsBetter: boolean;
  description?: string;
};

export type ModelEntry = {
  id: string;
  name: string;
  org: string;
  /** true/false se la fonte lo dice; undefined se non si sa. */
  open?: boolean;
  /** true se "open" è stimato da noi (dal nome/famiglia), non dichiarato dalla fonte. */
  openGuessed?: boolean;
  released?: string;
  scores: Record<string, number>;
};

export type ModelCategory = { benchmarks: Benchmark[]; models: ModelEntry[] };

export type ModelsData = {
  updatedAt: number;
  source: string;
  llm: ModelCategory;
  image: ModelCategory;
  video: ModelCategory;
};

export const KIND_LABEL: Record<ModelKind, string> = { llm: "Testo (LLM)", image: "Immagini", video: "Video" };

/** Le famiglie che vuoi seguire sempre (filtro di default per gli LLM). */
export const TRACKED_ORGS = [
  "OpenAI",
  "Anthropic",
  "Google",
  "xAI",
  "Meta",
  "DeepSeek",
  "Moonshot AI",
  "Z.ai",
  "Mistral",
  "Alibaba",
  "NVIDIA",
  "Xiaomi",
] as const;

/** Normalizza i nomi delle aziende come li scrive la fonte ("Zhipu AI", "Moonshot"…) nei nostri. */
export function normalizeOrg(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes("openai")) return "OpenAI";
  if (s.includes("anthropic")) return "Anthropic";
  if (s.includes("google") || s.includes("deepmind")) return "Google";
  if (s === "xai" || s.includes("x.ai") || s.includes("xai")) return "xAI";
  if (s.includes("meta")) return "Meta";
  if (s.includes("deepseek")) return "DeepSeek";
  if (s.includes("moonshot") || s.includes("kimi")) return "Moonshot AI";
  if (s.includes("zhipu") || s.includes("z.ai") || s === "zai" || s.includes("glm")) return "Z.ai";
  if (s.includes("mistral")) return "Mistral";
  if (s.includes("alibaba") || s.includes("qwen")) return "Alibaba";
  if (s.includes("nvidia")) return "NVIDIA";
  if (s.includes("xiaomi") || s.includes("mimo")) return "Xiaomi";
  return raw;
}

/** Stima "open weights" dal nome quando la fonte non lo dice. Segnato come stimato nell'interfaccia. */
const OPEN_FAMILIES =
  /\b(llama|deepseek|qwen|qwq|glm|kimi|mistral|mixtral|magistral|devstral|gemma|gpt-oss|nemotron|mimo|olmo|phi|flux[ .-]?(dev|schnell|kontext dev)|stable diffusion|sdxl|hunyuan|wan ?2|ltx|cogvideo|mochi|hidream|qwen-image)\b/i;
const CLOSED_HINTS = /\b(pro|max|large 2|mistral medium|mistral large)\b/i;

export function guessOpen(name: string, org: string): boolean | undefined {
  if (/^(openai|anthropic|xai|google)$/i.test(org) && !/gpt-oss|gemma/i.test(name)) return false;
  if (OPEN_FAMILIES.test(name)) return !(org === "Mistral" && CLOSED_HINTS.test(name)) && !/qwen.*max/i.test(name);
  return undefined;
}

/* ------------------------------------------------------------------ */
/* Benchmark noti (gli altri campi numerici della fonte vengono       */
/* comunque mostrati, con un nome ricavato dalla chiave)              */
/* ------------------------------------------------------------------ */

const KNOWN: Record<string, Omit<Benchmark, "key">> = {
  artificial_analysis_intelligence_index: {
    label: "Intelligence Index",
    unit: "punti",
    higherIsBetter: true,
    description: "Indice di intelligenza generale di Artificial Analysis: media di più benchmark difficili.",
  },
  aa_intelligence_index_v4: {
    label: "Intelligence Index v4",
    unit: "punti",
    higherIsBetter: true,
    description: "Versione precedente dell'indice: scala diversa, non confrontabile con la v5.",
  },
  artificial_analysis_coding_index: { label: "Coding Index", unit: "punti", higherIsBetter: true },
  aa_coding_agent_index: { label: "Coding Agent Index", unit: "punti", higherIsBetter: true, description: "Agenti che programmano (Artificial Analysis)." },
  artificial_analysis_math_index: { label: "Math Index", unit: "punti", higherIsBetter: true },
  artificial_analysis_agentic_index: { label: "Agentic Index", unit: "punti", higherIsBetter: true },
  mmlu_pro: { label: "MMLU-Pro", unit: "%", higherIsBetter: true, description: "Conoscenza generale, domande difficili." },
  gpqa: { label: "GPQA Diamond", unit: "%", higherIsBetter: true, description: "Scienza a livello dottorato." },
  hle: { label: "Humanity's Last Exam", unit: "%", higherIsBetter: true, description: "Domande di frontiera, molto difficili." },
  livecodebench: { label: "LiveCodeBench", unit: "%", higherIsBetter: true, description: "Programmazione competitiva." },
  scicode: { label: "SciCode", unit: "%", higherIsBetter: true, description: "Codice scientifico." },
  math_500: { label: "MATH-500", unit: "%", higherIsBetter: true },
  aime: { label: "AIME", unit: "%", higherIsBetter: true, description: "Olimpiadi di matematica." },
  aime_25: { label: "AIME 2025", unit: "%", higherIsBetter: true, description: "Olimpiadi di matematica." },
  ifbench: { label: "IFBench", unit: "%", higherIsBetter: true, description: "Seguire istruzioni." },
  lcr: { label: "Long Context (AA-LCR)", unit: "%", higherIsBetter: true, description: "Ragionamento su testi lunghi." },
  terminalbench_hard: { label: "Terminal-Bench Hard", unit: "%", higherIsBetter: true, description: "Agenti nel terminale." },
  tau2: { label: "τ²-Bench", unit: "%", higherIsBetter: true, description: "Agenti che usano strumenti." },
  elo: { label: "Arena ELO", unit: "elo", higherIsBetter: true, description: "Preferenze umane in confronti alla cieca." },
  output_speed: { label: "Velocità", unit: "tok/s", higherIsBetter: true, description: "Token generati al secondo (mediana)." },
  price_blended: { label: "Prezzo", unit: "$/1M", higherIsBetter: false, description: "Prezzo misto per 1M token (3:1 input/output)." },
};

export function benchmarkFor(key: string): Benchmark {
  const known = KNOWN[key];
  if (known) return { key, ...known };
  const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return { key, label, unit: "punti", higherIsBetter: true };
}

/** Ordine di presentazione: indici prima, poi benchmark, poi velocità e prezzo. */
export function sortBenchmarks(keys: string[]): Benchmark[] {
  const order = Object.keys(KNOWN);
  return [...new Set(keys)]
    .map(benchmarkFor)
    .sort((a, b) => {
      const ia = order.indexOf(a.key);
      const ib = order.indexOf(b.key);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.label.localeCompare(b.label);
    });
}

const it = (v: number, digits: number) => v.toLocaleString("it-IT", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export function formatScore(value: number, unit: Benchmark["unit"]) {
  if (unit === "%") return `${it(value, 1)}%`;
  if (unit === "$/1M") return `$${it(value, value < 1 ? 2 : 1)}`;
  if (unit === "elo" || unit === "tok/s") return it(value, 0);
  return it(value, 1);
}

// Dati di partenza della sezione Modelli AI, raccolti a mano da fonti pubbliche (inizio novembre 2026).
// Si usano solo finché non arrivano dati veri: la sincronizzazione con Artificial Analysis (AA_API_KEY)
// o un agente che chiama POST /api/agent/models li sostituiscono.
//
// Regola: nessun numero inventato. Un modello ha solo i benchmark per cui c'è una fonte;
// indici di versioni diverse (AA v5 e v4) stanno in chiavi diverse perché non sono confrontabili.
//
// Fonti:
//  - Intelligence Index v5:  https://artificialanalysis.ai/leaderboards/models
//                            https://www.benchleader.com/benchmarks/aa_intelligence_index_v5
//                            pagine modello su artificialanalysis.ai (Qwen3.8, Muse Spark, Nemotron 3.5) e post AA su Grok 4.7
//  - Intelligence Index v4:  https://www.unite.ai/xiaomis-new-flagship-model-leads-open-weight-rankings-with-a-score-of-46/
//  - GPQA Diamond:           https://www.vellum.ai/llm-leaderboard
//  - Immagini (Elo):         https://artificialanalysis.ai/image/leaderboard/text-to-image
//  - Video (Elo):            https://artificialanalysis.ai/video/leaderboard/text-to-video

import { sortBenchmarks, type ModelCategory, type ModelEntry, type ModelsData } from "@/lib/models";

type Seed = Omit<ModelEntry, "id">;

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

function category(models: Seed[]): ModelCategory {
  const entries = models.map((m) => ({ id: slug(`${m.org}-${m.name}`), ...m }));
  return { benchmarks: sortBenchmarks(entries.flatMap((m) => Object.keys(m.scores))), models: entries };
}

const V5 = "artificial_analysis_intelligence_index";
const V4 = "aa_intelligence_index_v4";

const llm: Seed[] = [
  { name: "Gemini 4 Carbon (High)", org: "Google", open: false, scores: { [V5]: 60 } },
  { name: "Claude Opus 5.5 (Max)", org: "Anthropic", open: false, scores: { [V5]: 59 } },
  { name: "GPT-6 Astra (Max)", org: "OpenAI", open: false, scores: { [V5]: 57, gpqa: 96.3 } },
  // Pesi annunciati come aperti ma non ancora pubblicati: open non dichiarato.
  { name: "Kimi K3.1 Pro", org: "Moonshot AI", scores: { [V5]: 46 } },
  { name: "Grok 4.7 (xhigh)", org: "xAI", open: false, scores: { [V5]: 46, aa_coding_agent_index: 56 } },
  { name: "Muse Spark 1.3 (Max)", org: "Meta", open: false, scores: { [V5]: 37 } },
  { name: "Qwen3.8 Max (0902)", org: "Alibaba", open: false, scores: { [V5]: 34 } },
  { name: "DeepSeek V4.1 Flash 1017 (Max)", org: "DeepSeek", open: true, scores: { [V5]: 33 } },
  { name: "GLM-5.3 (Max)", org: "Z.ai", open: true, scores: { [V5]: 32, gpqa: 91.7 } },
  { name: "Inkling 2 Small", org: "Thinking Machines", scores: { [V5]: 31 } },
  { name: "Mistral Large 4 Preview", org: "Mistral", open: false, scores: { [V5]: 25 } },
  { name: "Muse Spark Open (xhigh)", org: "Meta", open: true, scores: { [V5]: 25 } },
  { name: "Nemotron 3.5 Lightning", org: "NVIDIA", scores: { [V5]: 24 } },
  { name: "Qwen3.8 27B", org: "Alibaba", open: true, scores: { [V5]: 20 } },
  { name: "Nemotron 3.5 Super VL", org: "NVIDIA", scores: { [V5]: 14 } },

  // Solo sull'indice v4 (scala vecchia, non confrontabile con v5).
  { name: "Nemotron 3 Ultra", org: "NVIDIA", open: true, scores: { [V4]: 48 } },
  { name: "MiMo-V2.6-Pro", org: "Xiaomi", open: true, scores: { [V4]: 46 } },

  // Solo GPQA Diamond (Vellum).
  { name: "Gemini 3.8 Flash", org: "Google", open: false, scores: { gpqa: 95.3 } },
  { name: "GPT-5.6 Sol", org: "OpenAI", open: false, scores: { gpqa: 94.1 } },
  { name: "Kimi K3", org: "Moonshot AI", scores: { gpqa: 93.5 } },
  { name: "MiniMax M3", org: "MiniMax", scores: { gpqa: 92.9 } },
  { name: "DeepSeek V4 Pro 0813", org: "DeepSeek", open: true, scores: { gpqa: 92.8 } },
];

const image: Seed[] = [
  { name: "GPT Image 2.5 Sunburst (max)", org: "OpenAI", open: false, scores: { elo: 1227 } },
  { name: "GPT Image 2.5 Flare (max)", org: "OpenAI", open: false, scores: { elo: 1208 } },
  { name: "GPT Image 2 (high)", org: "OpenAI", open: false, scores: { elo: 1188 } },
  { name: "Nano Banana 2.1", org: "Google", open: false, scores: { elo: 1175 } },
  { name: "MAI-Image-2.6", org: "Microsoft", open: false, scores: { elo: 1169 } },
  { name: "Qwen-Image-2.1", org: "Alibaba", open: true, scores: { elo: 1044 } },
  { name: "FLUX 3 Image Klein", org: "Black Forest Labs", open: true, scores: { elo: 1043 } },
  { name: "Fibo 2.0", org: "Bria", scores: { elo: 1040 } },
];

const video: Seed[] = [
  { name: "Wan 3.0", org: "Alibaba", open: true, scores: { elo: 1172 } },
  { name: "Utopai X", org: "Utopai", scores: { elo: 1169 } },
  { name: "MiniMax H3 (768p)", org: "MiniMax", scores: { elo: 1160 } },
  { name: "FLUX 3 Max", org: "Black Forest Labs", open: false, scores: { elo: 1156 } },
  { name: "Dreamina Seedance 2.5", org: "ByteDance", open: false, scores: { elo: 1155 } },
];

export const MODELS_SEED: ModelsData = {
  updatedAt: Date.UTC(2026, 10, 5),
  source: "raccolta manuale · Artificial Analysis (Index v5, Elo immagini/video) + Vellum (GPQA)",
  llm: category(llm),
  image: category(image),
  video: category(video),
};

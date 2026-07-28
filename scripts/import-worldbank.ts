/**
 * Importe de vrais indicateurs depuis l'API publique de la Banque mondiale
 * (World Bank Open Data) dans la base SQLite de DataFinder (idempotent).
 *
 * Usage :
 *   npx tsx scripts/import-worldbank.ts [nombre]
 */
import { dbDatasetExists, dbInsertDataset } from "../lib/db";
import { listDatasets, type Dataset } from "../lib/datasets";

const API_BASE = "https://api.worldbank.org/v2/indicator";
const PAGE_SIZE = 20000;
const TARGET_COUNT = Number(process.argv[2]) || 2000;

const ACCENT_PALETTE = ["#6d5dfc", "#0d9f85", "#3387e8", "#f0a629", "#e65e79", "#9365d8", "#2a9d8f", "#e63946", "#f4a261", "#457b9d", "#588157", "#bc6c25"];

// Les indicateurs de la Banque mondiale portent un thème (topic) plus ou
// moins précis ; on le fait correspondre aux domaines déjà utilisés ailleurs
// dans le catalogue (lib/seed.ts, import-datagouv.ts) pour ne pas fragmenter
// le compteur "domaines couverts". "Économie" sert de repli par défaut, car
// c'est le cœur historique des indicateurs de la Banque mondiale.
const TOPIC_DOMAIN_MAP: Record<string, string> = {
  "social protection & labor": "Emploi",
  "external debt": "Économie",
  "education": "Éducation",
  "economy & growth": "Économie",
  "financial sector": "Économie",
  "environment": "Environnement",
  "public sector": "Administration publique",
  "poverty": "Économie",
  "private sector": "Économie",
  "infrastructure": "Transport",
  "climate change": "Environnement",
  "aid effectiveness": "Économie",
  "trade": "Économie",
  "energy & mining": "Environnement",
  "agriculture & rural development": "Agriculture",
  "urban development": "Immobilier",
  "millenium development goals": "Divers",
  "science & technology": "Recherche",
  "gender": "Démographie",
  "health": "Santé",
};

type WbIndicator = {
  id: string;
  name: string;
  unit?: string;
  source?: { value?: string };
  sourceNote?: string;
  sourceOrganization?: string;
  topics?: Array<{ value: string }>;
};

function slugify(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "indicateur"
  );
}

function cleanDescription(raw: string): string {
  const plain = raw.replace(/\s+/g, " ").trim();
  return plain.length > 320 ? `${plain.slice(0, 317)}...` : plain || "Aucune description fournie.";
}

function pickAccent(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return ACCENT_PALETTE[hash % ACCENT_PALETTE.length];
}

// Pas de métrique de popularité dans cette API (ni vues, ni téléchargements) :
// le score dérive d'un hash déterministe pour éviter un score identique sur
// les 2000 entrées tout en restant stable d'un import à l'autre.
function scoreFromId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return 45 + (hash % 26);
}

function classifyDomain(topics: Array<{ value: string }> | undefined): string {
  const first = topics?.[0]?.value?.trim().toLowerCase();
  if (!first) return "Économie";
  return TOPIC_DOMAIN_MAP[first] ?? "Économie";
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { "User-Agent": "DataFinder-import-script (self-hosted)" } });
  if (!response.ok) throw new Error(`${url} a répondu ${response.status}`);
  return response.json() as Promise<T>;
}

function mapDataset(raw: WbIndicator): Dataset {
  const id = `wb-${slugify(raw.id)}`;
  const topicValues = (raw.topics ?? []).map((t) => t.value.trim()).filter(Boolean);
  const provider = raw.source?.value?.trim() || "Banque mondiale";

  return {
    id,
    title: raw.name.trim(),
    provider,
    sourceType: "API",
    description: cleanDescription(raw.sourceNote ?? ""),
    domain: classifyDomain(raw.topics),
    country: "Monde",
    period: "Série historique",
    formats: ["CSV", "JSON", "XML"],
    license: "CC BY 4.0",
    update: "Mise à jour annuelle",
    score: scoreFromId(id),
    size: "Variable",
    access: "API et téléchargement",
    variables: topicValues.length ? topicValues.slice(0, 4) : ["indicateur"],
    url: `https://data.worldbank.org/indicator/${raw.id}`,
    tags: (topicValues.length ? topicValues : ["Banque mondiale"]).slice(0, 2),
    accent: pickAccent(id),
  };
}

async function main() {
  console.log(`Import de jusqu'à ${TARGET_COUNT} datasets depuis la Banque mondiale...`);

  const existingUrls = new Set(listDatasets(1, 1_000_000).data.map((d) => d.url));

  let imported = 0;
  let skippedExisting = 0;
  let skippedDuplicateUrl = 0;
  let skippedNoDescription = 0;
  let page = 1;

  while (imported < TARGET_COUNT) {
    const payload = await fetchJson<[{ pages: number }, WbIndicator[]]>(`${API_BASE}?format=json&per_page=${PAGE_SIZE}&page=${page}`);
    const [meta, items] = payload;

    for (const raw of items) {
      if (imported >= TARGET_COUNT) break;

      if (!raw.sourceNote || !raw.sourceNote.trim()) {
        skippedNoDescription += 1;
        continue;
      }

      const url = `https://data.worldbank.org/indicator/${raw.id}`;
      if (existingUrls.has(url)) {
        skippedDuplicateUrl += 1;
        continue;
      }

      const dataset = mapDataset(raw);
      if (dbDatasetExists(dataset.id)) {
        skippedExisting += 1;
        continue;
      }

      dbInsertDataset(dataset);
      existingUrls.add(url);
      imported += 1;
    }

    page += 1;
    if (page > meta.pages) break;
  }

  console.log(`Terminé : ${imported} datasets importés, ${skippedExisting} déjà présents (id), ${skippedDuplicateUrl} déjà présents (URL), ${skippedNoDescription} ignorés (sans description).`);
}

main().catch((error) => {
  console.error("Échec de l'import :", error);
  process.exit(1);
});

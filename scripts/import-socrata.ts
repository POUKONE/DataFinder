/**
 * Importe de vrais jeux de données depuis l'API publique Discovery de
 * Socrata, qui agrège les catalogues de centaines de portails open-data
 * (villes, États, agences, quelques portails internationaux) dans la base
 * SQLite de DataFinder (idempotent).
 *
 * Usage :
 *   npx tsx scripts/import-socrata.ts [nombre]
 */
import { dbDatasetExists, dbInsertDataset } from "../lib/db";
import { listDatasets, type Dataset } from "../lib/datasets";

const API_BASE = "https://api.us.socrata.com/api/catalog/v1";
const PAGE_SIZE = 100;
const TARGET_COUNT = Number(process.argv[2]) || 2000;

const ACCENT_PALETTE = ["#6d5dfc", "#0d9f85", "#3387e8", "#f0a629", "#e65e79", "#9365d8", "#2a9d8f", "#e63946", "#f4a261", "#457b9d", "#588157", "#bc6c25"];

// Les portails Socrata utilisent chacun leur propre taxonomie de catégories
// (texte libre, parfois en espagnol) : on les fait correspondre aux domaines
// déjà utilisés ailleurs dans le catalogue par recherche de mots-clés, comme
// pour import-datagouv.ts.
const DOMAIN_KEYWORDS: Array<[string, string[]]> = [
  ["Sécurité", ["public safety", "police", "law enforcement", "crime", "justice", "fire"]],
  ["Santé", ["health", "salud", "hospital", "vaccination", "medical", "covid"]],
  ["Transport", ["transportation", "transit", "trucking", "mobility", "traffic", "parking"]],
  ["Immobilier", ["housing", "building", "development", "vivienda", "permitting", "construction", "zoning"]],
  ["Administration publique", ["government", "administration", "gobierno", "city government", "local government", "regulatory", "licenses", "permits", "hacienda"]],
  ["Économie", ["finance", "economic", "business", "revenue", "budget", "workforce", "crédito"]],
  ["Environnement", ["environment", "energy", "water", "climate", "sustainability"]],
  ["Éducation", ["education", "school", "student"]],
  ["Emploi", ["employment", "labor", "jobs"]],
  ["Démographie", ["population", "census", "demographic", "social services", "inclusión social"]],
  ["Recherche", ["research and statistics", "statistics", "estadísticas"]],
];

type SocrataResult = {
  resource: {
    id: string;
    name: string;
    description?: string;
    attribution?: string;
    type: string;
    page_views?: { page_views_total?: number };
  };
  classification: { domain_category?: string; domain_tags?: string[] };
  metadata: { domain?: string; license?: string };
  permalink: string;
};

function slugify(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "portail"
  );
}

function humanize(value: string): string {
  const cleaned = value.replace(/[-_]/g, " ").trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function cleanDescription(raw: string): string {
  const plain = raw
    .replace(/<\/?[^>]+(>|$)/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > 320 ? `${plain.slice(0, 317)}...` : plain || "Aucune description fournie.";
}

function classifyDomain(category: string | undefined, tags: string[] | undefined, title: string): string {
  const haystacks = [category ?? "", ...(tags ?? []), title].map((t) => t.toLowerCase());
  for (const [domain, keywords] of DOMAIN_KEYWORDS) {
    if (haystacks.some((text) => keywords.some((keyword) => text.includes(keyword)))) return domain;
  }
  return "Divers";
}

function pickAccent(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return ACCENT_PALETTE[hash % ACCENT_PALETTE.length];
}

function scoreFromViews(views: number): number {
  return Math.max(40, Math.min(98, Math.round(Math.log10(views + 1) * 12 + 40)));
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { "User-Agent": "DataFinder-import-script (self-hosted)" } });
  if (!response.ok) throw new Error(`${url} a répondu ${response.status}`);
  return response.json() as Promise<T>;
}

function mapDataset(raw: SocrataResult): Dataset {
  const portal = raw.metadata.domain ?? "opendata";
  const id = `socrata-${slugify(portal)}-${slugify(raw.resource.id)}`;
  const tags = (raw.classification.domain_tags ?? []).slice(0, 4).map(humanize);
  const views = raw.resource.page_views?.page_views_total ?? 0;

  return {
    id,
    title: raw.resource.name,
    provider: raw.resource.attribution || portal,
    sourceType: "Gouvernement",
    description: cleanDescription(raw.resource.description ?? ""),
    domain: classifyDomain(raw.classification.domain_category, raw.classification.domain_tags, raw.resource.name),
    country: "Multi-pays",
    period: "Variable",
    formats: ["CSV", "JSON", "XLSX"],
    license: raw.metadata.license ?? "Non spécifiée",
    update: "Variable",
    score: scoreFromViews(views),
    size: "Variable",
    access: "Téléchargement direct",
    variables: tags.length ? tags : ["donnée"],
    url: raw.permalink,
    tags: (tags.length ? tags : ["Open data"]).slice(0, 2),
    accent: pickAccent(id),
  };
}

async function main() {
  console.log(`Import de jusqu'à ${TARGET_COUNT} datasets depuis Socrata...`);

  const existingUrls = new Set((await listDatasets(1, 1_000_000)).data.map((d) => d.url));

  let imported = 0;
  let skippedExisting = 0;
  let skippedDuplicateUrl = 0;
  let skippedNoLicense = 0;
  let offset = 0;

  while (imported < TARGET_COUNT) {
    const payload = await fetchJson<{ results: SocrataResult[] }>(
      `${API_BASE}?limit=${PAGE_SIZE}&offset=${offset}&only=datasets`,
    );
    if (payload.results.length === 0) break;

    for (const raw of payload.results) {
      if (imported >= TARGET_COUNT) break;

      if (!raw.metadata.license || !raw.metadata.license.trim()) {
        skippedNoLicense += 1;
        continue;
      }

      if (existingUrls.has(raw.permalink)) {
        skippedDuplicateUrl += 1;
        continue;
      }

      const dataset = mapDataset(raw);
      if (await dbDatasetExists(dataset.id)) {
        skippedExisting += 1;
        continue;
      }

      await dbInsertDataset(dataset);
      existingUrls.add(raw.permalink);
      imported += 1;
    }

    offset += PAGE_SIZE;
    if (offset > 9900) break; // Discovery API caps result windows around 10k.
  }

  console.log(`Terminé : ${imported} datasets importés, ${skippedExisting} déjà présents (id), ${skippedDuplicateUrl} déjà présents (URL), ${skippedNoLicense} ignorés (sans licence).`);
}

main().catch((error) => {
  console.error("Échec de l'import :", error);
  process.exit(1);
});

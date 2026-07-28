/**
 * Importe de vrais jeux de données depuis l'API publique de HuggingFace
 * Datasets Hub dans la base SQLite de DataFinder (idempotent).
 *
 * Usage :
 *   npx tsx scripts/import-huggingface.ts [nombre]
 */
import { dbDatasetExists, dbInsertDataset } from "../lib/db";
import { listDatasets, type Dataset } from "../lib/datasets";

const API_BASE = "https://huggingface.co/api/datasets";
const PAGE_SIZE = 100;
const TARGET_COUNT = Number(process.argv[2]) || 2000;

const LICENSE_LABELS: Record<string, string> = {
  mit: "MIT",
  "apache-2.0": "Apache 2.0",
  "cc-by-4.0": "CC BY 4.0",
  "cc-by-3.0": "CC BY 3.0",
  "cc-by-sa-4.0": "CC BY-SA 4.0",
  "cc-by-sa-3.0": "CC BY-SA 3.0",
  "cc0-1.0": "CC0",
  "cc-by-nc-4.0": "CC BY-NC 4.0",
  "cc-by-nc-sa-4.0": "CC BY-NC-SA 4.0",
  "cc-by-nc-sa-3.0": "CC BY-NC-SA 3.0",
  "odc-by": "ODC-BY",
  "odbl": "ODbL",
  "gpl-3.0": "GPL 3.0",
  "bsd-3-clause": "BSD 3-Clause",
  "openrail": "OpenRAIL",
  "openrail++": "OpenRAIL++",
  "other": "Autre licence",
  "unknown": "Non spécifiée",
};

const ACCENT_PALETTE = ["#6d5dfc", "#0d9f85", "#3387e8", "#f0a629", "#e65e79", "#9365d8", "#2a9d8f", "#e63946", "#f4a261", "#457b9d", "#588157", "#bc6c25"];

type HfDataset = {
  id: string;
  author?: string;
  description?: string;
  downloads?: number;
  gated?: boolean | string;
  private?: boolean;
  disabled?: boolean;
  tags?: string[];
};

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "dataset";
}

function cleanDescription(raw: string): string {
  const plain = raw
    .replace(/^#{1,6}\s*.*$/gm, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_`>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > 320 ? `${plain.slice(0, 317)}...` : plain || "Aucune description fournie.";
}

function humanizeTagValue(value: string): string {
  const cleaned = value.replace(/[-_]/g, " ").trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function pickAccent(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return ACCENT_PALETTE[hash % ACCENT_PALETTE.length];
}

function scoreFromDownloads(downloads: number): number {
  return Math.max(40, Math.min(98, Math.round(Math.log10(downloads + 1) * 12 + 40)));
}

async function fetchNextPage(url: string): Promise<{ items: HfDataset[]; nextUrl: string | null }> {
  const response = await fetch(url, { headers: { "User-Agent": "DataFinder-import-script (self-hosted)" } });
  if (!response.ok) throw new Error(`${url} a répondu ${response.status}`);
  const items = (await response.json()) as HfDataset[];
  const link = response.headers.get("link");
  const match = link ? link.match(/<([^>]+)>;\s*rel="next"/) : null;
  return { items, nextUrl: match ? match[1] : null };
}

function mapDataset(raw: HfDataset): Dataset {
  const id = `hf-${slugify(raw.id)}`;
  const formatTags = (raw.tags ?? []).filter((t) => t.startsWith("format:")).map((t) => t.slice("format:".length).toUpperCase());
  const licenseTag = (raw.tags ?? []).find((t) => t.startsWith("license:"))?.slice("license:".length);
  const plainTags = (raw.tags ?? []).filter((t) => !t.includes(":")).slice(0, 4).map(humanizeTagValue);
  const downloads = raw.downloads ?? 0;

  return {
    id,
    title: raw.id,
    provider: raw.author ?? raw.id.split("/")[0] ?? "HuggingFace",
    sourceType: "Recherche",
    description: cleanDescription(raw.description ?? ""),
    domain: "Machine learning",
    country: "Monde",
    period: "Mise à jour continue",
    formats: formatTags.length ? formatTags : ["Autre"],
    license: licenseTag ? (LICENSE_LABELS[licenseTag] ?? humanizeTagValue(licenseTag)) : "Non spécifiée",
    update: "Mise à jour continue",
    score: scoreFromDownloads(downloads),
    size: "Variable",
    access: "API et téléchargement",
    variables: plainTags.length ? plainTags : ["dataset"],
    url: `https://huggingface.co/datasets/${raw.id}`,
    tags: (plainTags.length ? plainTags : ["Machine learning"]).slice(0, 2),
    accent: pickAccent(id),
  };
}

async function main() {
  console.log(`Import de jusqu'à ${TARGET_COUNT} datasets depuis HuggingFace...`);

  const existingUrls = new Set((await listDatasets(1, 1_000_000)).data.map((d) => d.url));

  let imported = 0;
  let skippedExisting = 0;
  let skippedDuplicateUrl = 0;
  let skippedUnavailable = 0;
  let nextUrl: string | null = `${API_BASE}?limit=${PAGE_SIZE}&sort=downloads&direction=-1&full=true`;

  while (nextUrl && imported < TARGET_COUNT) {
    const { items, nextUrl: following } = await fetchNextPage(nextUrl);

    for (const raw of items) {
      if (imported >= TARGET_COUNT) break;

      if (raw.gated || raw.private || raw.disabled) {
        skippedUnavailable += 1;
        continue;
      }

      const url = `https://huggingface.co/datasets/${raw.id}`;
      if (existingUrls.has(url)) {
        skippedDuplicateUrl += 1;
        continue;
      }

      const dataset = mapDataset(raw);
      if (await dbDatasetExists(dataset.id)) {
        skippedExisting += 1;
        continue;
      }

      await dbInsertDataset(dataset);
      existingUrls.add(url);
      imported += 1;
    }

    nextUrl = following;
  }

  console.log(`Terminé : ${imported} datasets importés, ${skippedExisting} déjà présents (id), ${skippedDuplicateUrl} déjà présents (URL), ${skippedUnavailable} ignorés (accès restreint).`);
}

main().catch((error) => {
  console.error("Échec de l'import :", error);
  process.exit(1);
});

/**
 * Importe de vrais jeux de données depuis l'API publique de Zenodo (dépôt
 * de données de recherche du CERN/OpenAIRE) dans la base SQLite de
 * DataFinder (idempotent).
 *
 * Usage :
 *   npx tsx scripts/import-zenodo.ts [nombre]
 */
import { dbDatasetExists, dbInsertDataset } from "../lib/db";
import { listDatasets, type Dataset } from "../lib/datasets";

const API_BASE = "https://zenodo.org/api/records";
const PAGE_SIZE = 25; // Zenodo caps unauthenticated requests at 25 results per page.
const TARGET_COUNT = Number(process.argv[2]) || 2000;

const LICENSE_LABELS: Record<string, string> = {
  "cc-by-4.0": "CC BY 4.0",
  "cc-by-3.0": "CC BY 3.0",
  "cc-by-sa-4.0": "CC BY-SA 4.0",
  "cc0-1.0": "CC0",
  "cc-zero": "CC0",
  "cc-by-nc-4.0": "CC BY-NC 4.0",
  "cc-by-nc-sa-4.0": "CC BY-NC-SA 4.0",
  "other-pd": "Domaine public",
  "mit": "MIT",
  "gpl-3.0": "GPL 3.0",
  "apache-2.0": "Apache 2.0",
  "other-open": "Autre licence ouverte",
};

const ACCENT_PALETTE = ["#6d5dfc", "#0d9f85", "#3387e8", "#f0a629", "#e65e79", "#9365d8", "#2a9d8f", "#e63946", "#f4a261", "#457b9d", "#588157", "#bc6c25"];

type ZenodoRecord = {
  id: number;
  links: { self_html: string };
  files?: Array<{ key: string; size?: number }>;
  stats?: { downloads?: number; views?: number };
  metadata: {
    title: string;
    description?: string;
    publication_date?: string;
    license?: { id?: string };
    keywords?: string[];
    creators?: Array<{ name: string; affiliation?: string }>;
    access_right?: string;
  };
};

function cleanDescription(raw: string): string {
  const plain = raw
    .replace(/<\/?[^>]+(>|$)/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > 320 ? `${plain.slice(0, 317)}...` : plain || "Aucune description fournie.";
}

function humanize(value: string): string {
  const cleaned = value.replace(/[-_]/g, " ").trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function pickAccent(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return ACCENT_PALETTE[hash % ACCENT_PALETTE.length];
}

function scoreFromViews(views: number): number {
  return Math.max(40, Math.min(98, Math.round(Math.log10(views + 1) * 12 + 40)));
}

function humanizeSize(bytes: number): string {
  if (bytes <= 0) return "Variable";
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return "< 1 Mo";
  if (mb < 1024) return `≈ ${Math.round(mb)} Mo`;
  return `≈ ${(mb / 1024).toFixed(1)} Go`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Zenodo limite les requêtes anonymes à ~30 par fenêtre ; on retente sur 429
// en respectant Retry-After plutôt que d'abandonner l'import.
async function fetchJson<T>(url: string, attempt = 1): Promise<T> {
  const response = await fetch(url, { headers: { "User-Agent": "DataFinder-import-script (self-hosted)" } });
  if (response.status === 429) {
    if (attempt > 3) throw new Error(`${url} toujours limité (429) après ${attempt} tentatives.`);
    const retryAfter = Number(response.headers.get("retry-after")) || 60;
    console.log(`Limite de débit Zenodo atteinte, pause de ${retryAfter}s...`);
    await sleep(retryAfter * 1000);
    return fetchJson<T>(url, attempt + 1);
  }
  if (!response.ok) throw new Error(`${url} a répondu ${response.status}`);
  return response.json() as Promise<T>;
}

function mapDataset(raw: ZenodoRecord): Dataset {
  const id = `zenodo-${raw.id}`;
  const files = raw.files ?? [];
  const formats = [...new Set(files.map((f) => f.key.split(".").pop()?.toUpperCase()).filter((ext): ext is string => typeof ext === "string" && ext.length <= 6))].slice(0, 6);
  const totalBytes = files.reduce((sum, f) => sum + (f.size ?? 0), 0);
  const licenseId = raw.metadata.license?.id;
  // Certains enregistrements Zenodo stockent leurs mots-clés comme une seule
  // chaîne séparée par des points-virgules plutôt qu'un vrai tableau.
  const keywords = (raw.metadata.keywords ?? [])
    .flatMap((k) => k.split(";"))
    .map((k) => k.trim())
    .filter(Boolean)
    .slice(0, 4)
    .map(humanize);
  const creator = raw.metadata.creators?.[0];
  const provider = creator ? (creator.affiliation ? `${creator.name} · ${creator.affiliation}` : creator.name) : "Zenodo";
  const year = raw.metadata.publication_date ? raw.metadata.publication_date.slice(0, 4) : "Variable";

  return {
    id,
    title: raw.metadata.title,
    provider,
    sourceType: "Recherche",
    description: cleanDescription(raw.metadata.description ?? ""),
    domain: "Recherche",
    country: "Monde",
    period: year,
    formats: formats.length ? formats : ["Autre"],
    license: licenseId ? (LICENSE_LABELS[licenseId] ?? humanize(licenseId)) : "Non spécifiée",
    update: "Archive stable",
    score: scoreFromViews(raw.stats?.views ?? 0),
    size: humanizeSize(totalBytes),
    access: "Téléchargement direct",
    variables: keywords.length ? keywords : ["donnée"],
    url: raw.links.self_html,
    tags: (keywords.length ? keywords : ["Recherche"]).slice(0, 2),
    accent: pickAccent(id),
  };
}

async function main() {
  console.log(`Import de jusqu'à ${TARGET_COUNT} datasets depuis Zenodo...`);

  const existingUrls = new Set(listDatasets(1, 1_000_000).data.map((d) => d.url));

  let imported = 0;
  let skippedExisting = 0;
  let skippedDuplicateUrl = 0;
  let skippedClosedOrEmpty = 0;
  let page = 1;

  while (imported < TARGET_COUNT) {
    const payload = await fetchJson<{ hits: { hits: ZenodoRecord[] } }>(
      `${API_BASE}?q=resource_type.type:dataset&sort=mostviewed&size=${PAGE_SIZE}&page=${page}`,
    );
    const records = payload.hits.hits;
    if (records.length === 0) break;

    for (const raw of records) {
      if (imported >= TARGET_COUNT) break;

      if (raw.metadata.access_right !== "open" || !raw.files || raw.files.length === 0) {
        skippedClosedOrEmpty += 1;
        continue;
      }

      if (existingUrls.has(raw.links.self_html)) {
        skippedDuplicateUrl += 1;
        continue;
      }

      const dataset = mapDataset(raw);
      if (dbDatasetExists(dataset.id)) {
        skippedExisting += 1;
        continue;
      }

      dbInsertDataset(dataset);
      existingUrls.add(raw.links.self_html);
      imported += 1;
    }

    page += 1;
    if (page > 500) break; // Safety cap: avoids an infinite loop if the API ever stops paginating cleanly.
    if (imported < TARGET_COUNT) await sleep(1500); // Reste sous la limite de débit anonyme de Zenodo.
  }

  console.log(`Terminé : ${imported} datasets importés, ${skippedExisting} déjà présents (id), ${skippedDuplicateUrl} déjà présents (URL), ${skippedClosedOrEmpty} ignorés (accès fermé ou sans fichier).`);
}

main().catch((error) => {
  console.error("Échec de l'import :", error);
  process.exit(1);
});

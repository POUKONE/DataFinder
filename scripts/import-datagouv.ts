/**
 * Importe de vrais jeux de données depuis l'API publique de data.gouv.fr
 * dans la base SQLite de DataFinder (idempotent : relancer le script
 * n'importe pas deux fois le même dataset).
 *
 * Usage :
 *   npx tsx scripts/import-datagouv.ts [nombre]
 *
 * Exemple :
 *   npx tsx scripts/import-datagouv.ts 2000
 *
 * Respecte DATAFINDER_DB_PATH comme le reste de l'app (par défaut
 * data/datafinder.db).
 */
import { dbDatasetExists, dbInsertDataset } from "../lib/db";
import { listDatasets, type Dataset } from "../lib/datasets";

const API_BASE = "https://www.data.gouv.fr/api/1";
const PAGE_SIZE = 100;
const TARGET_COUNT = Number(process.argv[2]) || 2000;

const SHORT_LICENSE_LABELS: Record<string, string> = {
  "cc-by": "CC BY",
  "cc-by-sa": "CC BY-SA",
  "cc-zero": "CC0",
  "fr-lo": "Licence Ouverte 2.0",
  lov2: "Licence Ouverte 2.0",
  notspecified: "Non spécifiée",
  "odc-by": "ODC-BY",
  "odc-odbl": "ODbL",
  "odc-pddl": "PDDL",
  "other-at": "Autre (attribution)",
  "other-open": "Autre licence ouverte",
  "other-pd": "Domaine public",
};

const ACCENT_PALETTE = ["#6d5dfc", "#0d9f85", "#3387e8", "#f0a629", "#e65e79", "#9365d8", "#2a9d8f", "#e63946", "#f4a261", "#457b9d", "#588157", "#bc6c25"];

// Regroupe les ~5000 tags libres de data.gouv.fr en une courte liste de
// domaines lisibles, par correspondance de mots-clés (bâtie à partir de la
// fréquence réelle des tags sur les 2000 datasets les plus consultés).
// Ordre = priorité en cas de tags multiples ; "Divers" est le repli.
// Les libellés reprennent, quand ils existent, les noms de domaine déjà
// utilisés dans lib/seed.ts (Météo, Économie, Cartographie...) pour éviter
// de fragmenter le compteur "domaines couverts" entre deux orthographes
// du même sujet.
const DOMAIN_KEYWORDS: Array<[string, string[]]> = [
  ["Politique", ["election", "elections", "referendum", "vote", "bureaux-de-vote", "elections-legislatives", "politique", "assemblee-nationale", "senat", "parlement"]],
  ["Santé", ["sante", "covid", "covid19", "covid-19", "coronavirus", "hopital", "medical", "sante-et-systeme-de-soins", "etablissement-de-sante", "pathologies", "assurance-maladie"]],
  ["Éducation", ["education", "enseignement", "enseignement-superieur", "etablissements-denseignement", "etablissement-denseignement-superieur", "formation", "formations", "formations-et-diplomes", "eleves", "eleves-etudiants-et-apprentis", "etudiants", "universite", "colleges", "college", "ecoles", "academie", "academies", "cpge", "uai", "scolaire", "diplomes", "examens"]],
  ["Emploi", ["emploi", "travail", "chomage", "recrutement", "assurance-chomage", "demande-demploi"]],
  ["Économie", ["economie", "entreprise", "entreprises", "commerce", "industrie", "consommation", "prix", "comptabilite-publique", "comptes-publics", "marches-publics", "fiscalite", "ressources-humaines", "observatoire-economique", "budget", "finances-publiques"]],
  ["Immobilier", ["logement", "immobilier", "urbanisme", "cadastre", "usage-des-sols", "batiments", "zonage", "foncier"]],
  ["Transport", ["transport", "transports", "mobilite", "mobilite-et-espace-public", "bus", "velo", "circulation", "gtfs", "stationnement", "routes", "voirie", "aerien", "ferroviaire", "accidentologie", "borne-de-recharge", "irve"]],
  ["Environnement", ["environnement", "observation-de-la-terre-et-environnement", "biodiversite", "eau", "hydrographie", "dechets", "pollution", "energie", "climat"]],
  ["Météo", ["meteo", "meteodatagouvfr", "meteorologiques", "climatologie"]],
  ["Agriculture", ["agriculture", "agricole", "viticulture", "peche"]],
  ["Culture", ["culture", "ministeredelaculture", "patrimoine", "cinema", "musee", "musees", "spectacle", "livre"]],
  ["Tourisme", ["tourisme", "hebergement-touristique"]],
  ["Sécurité", ["police", "securite", "delinquance", "justice"]],
  ["Cartographie", ["geolocalisation", "cartographie", "geographie", "carte", "adresse", "contours", "decoupage", "limites-administratives", "sig", "wms", "wfs", "wmts", "openstreetmap", "osm", "magosm", "altitude", "inspire", "unite-urbaine"]],
  ["Démographie", ["population", "recensement", "demographie", "deces", "etat-civil", "communes", "commune", "departement", "departements", "region", "regions", "epci", "territoire", "territoires", "territoires-et-regions", "metropole", "pays", "nationalite"]],
  ["Administration publique", ["administration", "donnees-ouvertes", "donnees", "service-public", "dila", "simulateur", "simulateurs-dila", "anct", "cnil", "collectivites-locales", "referentiel", "nomenclature-referentiel", "tableau-de-bord-regional", "gouvernement", "conseil-municipal", "deliberations", "annuaire"]],
  ["Recherche", ["recherche", "science", "sciences"]],
];

function classifyDomain(tags: string[], title: string): string {
  // Compare en sous-chaîne (pas en égalité stricte) car les tags data.gouv.fr
  // sont souvent composés ("elections-europeennes-2014"), et on retombe sur
  // le titre quand un dataset n'a carrément aucun tag.
  const haystacks = [...tags, title].map((t) => t.toLowerCase());
  for (const [domain, keywords] of DOMAIN_KEYWORDS) {
    if (haystacks.some((text) => keywords.some((keyword) => text.includes(keyword)))) return domain;
  }
  return "Divers";
}

type ApiDataset = {
  id: string;
  slug: string;
  title: string;
  description: string;
  license: string;
  frequency: string;
  page: string;
  tags: string[];
  quality?: { score?: number };
  organization?: { name: string } | null;
  owner?: { first_name: string; last_name: string } | null;
  resources?: Array<{ format?: string }>;
};

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "dataset";
}

function humanizeTag(tag: string): string {
  const cleaned = tag.replace(/-/g, " ").trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function cleanDescription(raw: string): string {
  const plain = raw
    .replace(/^#{1,6}\s*.*$/gm, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_`>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > 320 ? `${plain.slice(0, 317)}...` : plain || "Aucune description fournie.";
}

function pickAccent(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return ACCENT_PALETTE[hash % ACCENT_PALETTE.length];
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { "User-Agent": "DataFinder-import-script (self-hosted)" } });
  if (!response.ok) throw new Error(`${url} a répondu ${response.status}`);
  return response.json() as Promise<T>;
}

function mapDataset(raw: ApiDataset, frequencyLabels: Map<string, string>): Dataset {
  const id = `dgf-${slugify(raw.slug || raw.title)}`;
  const formats = [...new Set((raw.resources ?? []).map((r) => (r.format ?? "").toUpperCase()).filter(Boolean))].slice(0, 6);
  const rawTags = raw.tags ?? [];
  const domain = classifyDomain(rawTags, raw.title);
  const tags = rawTags.slice(0, 4).map(humanizeTag);
  const frequencyLabel = frequencyLabels.get(raw.frequency);
  const provider = raw.organization?.name ?? (raw.owner ? `${raw.owner.first_name} ${raw.owner.last_name}` : "data.gouv.fr");
  const qualityScore = raw.quality?.score ?? 0.5;

  return {
    id,
    title: raw.title,
    provider,
    sourceType: "Gouvernement",
    description: cleanDescription(raw.description ?? ""),
    domain,
    country: "France",
    period: frequencyLabel ? `Mise à jour ${frequencyLabel.toLowerCase()}` : "Variable",
    formats: formats.length ? formats : ["Autre"],
    license: SHORT_LICENSE_LABELS[raw.license] ?? raw.license ?? "Non spécifiée",
    update: frequencyLabel ?? "Inconnue",
    score: Math.max(40, Math.min(98, Math.round(qualityScore * 100))),
    size: raw.resources?.length ? `${raw.resources.length} ressource(s)` : "Variable",
    access: "Téléchargement direct",
    variables: tags.length ? tags : ["donnée"],
    url: raw.page,
    tags: (tags.length ? tags : ["Import data.gouv.fr"]).slice(0, 2),
    accent: pickAccent(id),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log(`Import de jusqu'à ${TARGET_COUNT} datasets depuis data.gouv.fr...`);

  const frequencies = await fetchJson<Array<{ id: string; label: string }>>(`${API_BASE}/datasets/frequencies/`);
  const frequencyLabels = new Map(frequencies.map((f) => [f.id, f.label]));

  const existingUrls = new Set(listDatasets(1, 1_000_000).data.map((d) => d.url));

  let imported = 0;
  let skippedExisting = 0;
  let skippedDuplicateUrl = 0;
  let skippedNoResource = 0;
  let page = 1;
  let nextUrl: string | null = `${API_BASE}/datasets/?page=${page}&page_size=${PAGE_SIZE}&sort=-views`;

  while (nextUrl && imported < TARGET_COUNT) {
    const payload: { data: ApiDataset[]; next_page: string | null } = await fetchJson(nextUrl);

    for (const raw of payload.data) {
      if (imported >= TARGET_COUNT) break;

      if (!raw.resources || raw.resources.length === 0) {
        skippedNoResource += 1;
        continue;
      }

      if (existingUrls.has(raw.page)) {
        skippedDuplicateUrl += 1;
        continue;
      }

      const dataset = mapDataset(raw, frequencyLabels);
      if (dbDatasetExists(dataset.id)) {
        skippedExisting += 1;
        continue;
      }

      dbInsertDataset(dataset);
      existingUrls.add(raw.page);
      imported += 1;
    }

    nextUrl = payload.next_page;
    page += 1;
    if (nextUrl) await sleep(200);
  }

  console.log(`Terminé : ${imported} datasets importés, ${skippedExisting} déjà présents (id), ${skippedDuplicateUrl} déjà présents (URL identique à un dataset existant), ${skippedNoResource} ignorés (sans ressource téléchargeable).`);
}

main().catch((error) => {
  console.error("Échec de l'import :", error);
  process.exit(1);
});

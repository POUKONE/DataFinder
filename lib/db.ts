import { createClient } from "@supabase/supabase-js";
import type { Dataset } from "./datasets";
import { seedDatasets } from "./seed";

type DatasetRow = {
  id: string;
  title: string;
  provider: string;
  source_type: string;
  description: string;
  domain: string;
  country: string;
  period: string;
  formats: string;
  license: string;
  update_frequency: string;
  score: number;
  size: string;
  access: string;
  variables: string;
  url: string;
  tags: string;
  accent: string;
};

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error("SUPABASE_URL et SUPABASE_SECRET_KEY doivent être définies (clé service_role, jamais la clé publique).");
}

// SUPABASE_SCHEMA permet d'isoler la suite de tests (schéma "test") du
// catalogue de production (schéma "public" par défaut) au sein du même
// projet Supabase, sans consommer un second projet gratuit.
const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { persistSession: false },
  db: { schema: process.env.SUPABASE_SCHEMA || "public" },
});

// L'API REST de Supabase plafonne le nombre de lignes renvoyées par requête
// (1000 par défaut) : on doit paginer nous-même pour récupérer tout le
// catalogue d'un coup.
const FETCH_ALL_BATCH_SIZE = 1000;

function rowToDataset(row: DatasetRow): Dataset {
  return {
    id: row.id,
    title: row.title,
    provider: row.provider,
    sourceType: row.source_type,
    description: row.description,
    domain: row.domain,
    country: row.country,
    period: row.period,
    formats: JSON.parse(row.formats),
    license: row.license,
    update: row.update_frequency,
    score: row.score,
    size: row.size,
    access: row.access,
    variables: JSON.parse(row.variables),
    url: row.url,
    tags: JSON.parse(row.tags),
    accent: row.accent,
  };
}

function datasetToRow(dataset: Dataset): DatasetRow {
  return {
    id: dataset.id,
    title: dataset.title,
    provider: dataset.provider,
    source_type: dataset.sourceType,
    description: dataset.description,
    domain: dataset.domain,
    country: dataset.country,
    period: dataset.period,
    formats: JSON.stringify(dataset.formats),
    license: dataset.license,
    update_frequency: dataset.update,
    score: dataset.score,
    size: dataset.size,
    access: dataset.access,
    variables: JSON.stringify(dataset.variables),
    url: dataset.url,
    tags: JSON.stringify(dataset.tags),
    accent: dataset.accent,
  };
}

// Amorce le catalogue avec la sélection curée au tout premier démarrage sur
// une base vide. La ligne meta("seeded") sert de verrou : sa contrainte
// d'unicité garantit qu'une seule instance (parmi plusieurs cold starts
// concurrents sur du serverless) effectue réellement l'insertion.
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureSeeded(attempt = 1): Promise<void> {
  const { error } = await supabase.from("meta").insert({ key: "seeded", value: "1" });
  if (error) {
    if (error.code === "23505") return; // déjà amorcée par une autre instance
    // "JWT issued at future" est une erreur ponctuelle observée sporadiquement
    // (build local et CI) au tout premier appel réseau vers Supabase, sans
    // rapport avec une vraie dérive d'horloge constatée par ailleurs ; un
    // simple nouvel essai suffit systématiquement à la faire disparaître.
    if (error.message.includes("JWT issued at future") && attempt < 3) {
      await sleep(300 * attempt);
      return ensureSeeded(attempt + 1);
    }
    throw new Error(`Impossible de vérifier l'amorçage de la base : ${error.message}`);
  }
  for (const dataset of seedDatasets) {
    const { error: insertError } = await supabase.from("datasets").insert(datasetToRow(dataset));
    if (insertError) throw new Error(`Échec de l'amorçage du catalogue : ${insertError.message}`);
  }
}

await ensureSeeded();

export async function dbListDatasets(pagination: { limit: number; offset: number }): Promise<Dataset[]> {
  const { data, error } = await supabase
    .from("datasets")
    .select("*")
    .order("score", { ascending: false })
    .range(pagination.offset, pagination.offset + pagination.limit - 1);
  if (error) throw new Error(`Échec de la lecture des datasets : ${error.message}`);
  return (data as DatasetRow[]).map(rowToDataset);
}

export async function dbCountDatasets(): Promise<number> {
  const { count, error } = await supabase.from("datasets").select("*", { count: "exact", head: true });
  if (error) throw new Error(`Échec du comptage des datasets : ${error.message}`);
  return count ?? 0;
}

export async function dbListAllDatasets(): Promise<Dataset[]> {
  const all: Dataset[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("datasets")
      .select("*")
      .range(offset, offset + FETCH_ALL_BATCH_SIZE - 1);
    if (error) throw new Error(`Échec de la lecture du catalogue : ${error.message}`);
    const rows = data as DatasetRow[];
    all.push(...rows.map(rowToDataset));
    if (rows.length < FETCH_ALL_BATCH_SIZE) break;
    offset += FETCH_ALL_BATCH_SIZE;
  }
  return all;
}

export type CatalogStats = { datasets: number; providers: number; domains: number; licenses: number };

export async function dbCatalogStats(): Promise<CatalogStats> {
  const { data, error } = await supabase.rpc("get_catalog_stats").single();
  if (error) throw new Error(`Échec du calcul des statistiques : ${error.message}`);
  // Postgres renvoie les bigint (COUNT) en JSON sous forme de chaîne pour
  // préserver la précision au-delà de Number.MAX_SAFE_INTEGER ; sans risque
  // de dépassement ici, on les convertit en nombre pour l'API/le front.
  const row = data as Record<keyof CatalogStats, number | string>;
  return {
    datasets: Number(row.datasets),
    providers: Number(row.providers),
    domains: Number(row.domains),
    licenses: Number(row.licenses),
  };
}

export async function dbHealthCheck(): Promise<boolean> {
  const { error } = await supabase.from("datasets").select("id").limit(1);
  return !error;
}

export async function dbGetDataset(id: string): Promise<Dataset | undefined> {
  const { data, error } = await supabase.from("datasets").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Échec de la lecture du dataset : ${error.message}`);
  return data ? rowToDataset(data as DatasetRow) : undefined;
}

export async function dbDatasetExists(id: string): Promise<boolean> {
  const { count, error } = await supabase.from("datasets").select("id", { count: "exact", head: true }).eq("id", id);
  if (error) throw new Error(`Échec de la vérification du dataset : ${error.message}`);
  return (count ?? 0) > 0;
}

export async function dbInsertDataset(dataset: Dataset): Promise<void> {
  const { error } = await supabase.from("datasets").insert(datasetToRow(dataset));
  if (error) throw new Error(`Échec de l'insertion du dataset : ${error.message}`);
}

export async function dbUpdateDataset(dataset: Dataset): Promise<boolean> {
  const { id, ...row } = datasetToRow(dataset);
  const { data, error } = await supabase.from("datasets").update(row).eq("id", id).select("id");
  if (error) throw new Error(`Échec de la mise à jour du dataset : ${error.message}`);
  return (data?.length ?? 0) > 0;
}

export async function dbDeleteDataset(id: string): Promise<boolean> {
  const { data, error } = await supabase.from("datasets").delete().eq("id", id).select("id");
  if (error) throw new Error(`Échec de la suppression du dataset : ${error.message}`);
  return (data?.length ?? 0) > 0;
}

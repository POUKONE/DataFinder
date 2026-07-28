/**
 * Migration ponctuelle : copie tout le catalogue de l'ancienne base SQLite
 * locale (data/datafinder.db) vers Supabase. Lit le fichier SQLite
 * directement (sans passer par lib/db.ts, qui ne parle plus qu'à Supabase
 * depuis la migration) et fait un upsert par lots, donc le script peut être
 * relancé sans risque en cas d'interruption.
 *
 * Usage :
 *   npx tsx scripts/migrate-to-supabase.ts
 */
import { DatabaseSync } from "node:sqlite";
import { createClient } from "@supabase/supabase-js";
import { join } from "node:path";

const BATCH_SIZE = 500;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error("SUPABASE_URL et SUPABASE_SECRET_KEY doivent être définies.");
}
const supabase = createClient(supabaseUrl, supabaseSecretKey, { auth: { persistSession: false } });

const dbPath = process.env.DATAFINDER_DB_PATH || join(process.cwd(), "data", "datafinder.db");
const sqlite = new DatabaseSync(dbPath, { readOnly: true });

type SqliteRow = {
  id: string;
  title: string;
  provider: string;
  sourceType: string;
  description: string;
  domain: string;
  country: string;
  period: string;
  formats: string;
  license: string;
  updateFrequency: string;
  score: number;
  size: string;
  access: string;
  variables: string;
  url: string;
  tags: string;
  accent: string;
};

function toSupabaseRow(row: SqliteRow) {
  return {
    id: row.id,
    title: row.title,
    provider: row.provider,
    source_type: row.sourceType,
    description: row.description,
    domain: row.domain,
    country: row.country,
    period: row.period,
    formats: row.formats,
    license: row.license,
    update_frequency: row.updateFrequency,
    score: row.score,
    size: row.size,
    access: row.access,
    variables: row.variables,
    url: row.url,
    tags: row.tags,
    accent: row.accent,
  };
}

async function main() {
  const rows = sqlite.prepare("SELECT * FROM datasets").all() as unknown as SqliteRow[];
  console.log(`${rows.length} datasets trouvés dans ${dbPath}.`);

  let migrated = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE).map(toSupabaseRow);
    const { error } = await supabase.from("datasets").upsert(batch, { onConflict: "id" });
    if (error) throw new Error(`Échec du lot ${i}-${i + batch.length} : ${error.message}`);
    migrated += batch.length;
    console.log(`${migrated}/${rows.length} migrés...`);
  }

  // Marque le catalogue comme déjà amorcé pour que lib/db.ts ne réinjecte
  // pas la sélection curée (déjà présente dans les lignes migrées ci-dessus).
  const { error: metaError } = await supabase.from("meta").upsert({ key: "seeded", value: "1" }, { onConflict: "key" });
  if (metaError) throw new Error(`Échec du marquage "seeded" : ${metaError.message}`);

  console.log(`Terminé : ${migrated} datasets migrés vers Supabase.`);
}

main().catch((error) => {
  console.error("Échec de la migration :", error);
  process.exit(1);
});

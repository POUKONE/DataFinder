import { DatabaseSync, type StatementResultingChanges } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Dataset } from "./datasets";
import { seedDatasets } from "./seed";

type DatasetRow = {
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

const dbPath = process.env.DATAFINDER_DB_PATH || join(process.cwd(), "data", "datafinder.db");
mkdirSync(dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);
// busy_timeout must be set before any statement that can contend for a lock
// (including the journal_mode switch itself), otherwise concurrent processes
// racing to create/upgrade a brand-new database file fail immediately with
// "database is locked" instead of waiting their turn.
db.exec("PRAGMA busy_timeout = 5000");
db.exec("PRAGMA journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS datasets (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    provider TEXT NOT NULL,
    sourceType TEXT NOT NULL,
    description TEXT NOT NULL,
    domain TEXT NOT NULL,
    country TEXT NOT NULL,
    period TEXT NOT NULL,
    formats TEXT NOT NULL,
    license TEXT NOT NULL,
    updateFrequency TEXT NOT NULL,
    score REAL NOT NULL,
    size TEXT NOT NULL,
    access TEXT NOT NULL,
    variables TEXT NOT NULL,
    url TEXT NOT NULL,
    tags TEXT NOT NULL,
    accent TEXT NOT NULL
  )
`);

db.exec(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);

function rowToDataset(row: DatasetRow): Dataset {
  return {
    id: row.id,
    title: row.title,
    provider: row.provider,
    sourceType: row.sourceType,
    description: row.description,
    domain: row.domain,
    country: row.country,
    period: row.period,
    formats: JSON.parse(row.formats),
    license: row.license,
    update: row.updateFrequency,
    score: row.score,
    size: row.size,
    access: row.access,
    variables: JSON.parse(row.variables),
    url: row.url,
    tags: JSON.parse(row.tags),
    accent: row.accent,
  };
}

const insertStatement = db.prepare(`
  INSERT INTO datasets (id, title, provider, sourceType, description, domain, country, period, formats, license, updateFrequency, score, size, access, variables, url, tags, accent)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

function insertDataset(dataset: Dataset) {
  insertStatement.run(
    dataset.id,
    dataset.title,
    dataset.provider,
    dataset.sourceType,
    dataset.description,
    dataset.domain,
    dataset.country,
    dataset.period,
    JSON.stringify(dataset.formats),
    dataset.license,
    dataset.update,
    dataset.score,
    dataset.size,
    dataset.access,
    JSON.stringify(dataset.variables),
    dataset.url,
    JSON.stringify(dataset.tags),
    dataset.accent,
  );
}

// Claim the one-time seeding job atomically via INSERT OR IGNORE on a marker
// row: only the process whose insert actually adds the row (changes > 0)
// performs the seeding. This is safe when several processes open the same
// brand-new database concurrently (as happens during `next build`, which
// collects page data across multiple workers), and — unlike reseeding
// whenever the datasets table is merely empty — it never re-inserts a seed
// dataset that an admin has since deleted on purpose.
const claimedSeed = db.prepare("INSERT OR IGNORE INTO meta (key, value) VALUES ('seeded', '1')").run() as StatementResultingChanges;
if (claimedSeed.changes > 0) {
  for (const dataset of seedDatasets) insertDataset(dataset);
}

export function dbListDatasets(pagination: { limit: number; offset: number }): Dataset[] {
  const rows = db
    .prepare("SELECT * FROM datasets ORDER BY score DESC LIMIT ? OFFSET ?")
    .all(pagination.limit, pagination.offset) as unknown as DatasetRow[];
  return rows.map(rowToDataset);
}

export function dbCountDatasets(): number {
  const { count } = db.prepare("SELECT COUNT(*) as count FROM datasets").get() as { count: number };
  return count;
}

export function dbHealthCheck(): boolean {
  try {
    db.prepare("SELECT 1").get();
    return true;
  } catch {
    return false;
  }
}

export function dbGetDataset(id: string): Dataset | undefined {
  const row = db.prepare("SELECT * FROM datasets WHERE id = ?").get(id) as unknown as DatasetRow | undefined;
  return row ? rowToDataset(row) : undefined;
}

export function dbDatasetExists(id: string): boolean {
  return db.prepare("SELECT 1 FROM datasets WHERE id = ?").get(id) !== undefined;
}

export function dbInsertDataset(dataset: Dataset): void {
  insertDataset(dataset);
}

const updateStatement = db.prepare(`
  UPDATE datasets SET
    title = ?, provider = ?, sourceType = ?, description = ?, domain = ?, country = ?,
    period = ?, formats = ?, license = ?, updateFrequency = ?, score = ?, size = ?,
    access = ?, variables = ?, url = ?, tags = ?, accent = ?
  WHERE id = ?
`);

export function dbUpdateDataset(dataset: Dataset): boolean {
  const result = updateStatement.run(
    dataset.title,
    dataset.provider,
    dataset.sourceType,
    dataset.description,
    dataset.domain,
    dataset.country,
    dataset.period,
    JSON.stringify(dataset.formats),
    dataset.license,
    dataset.update,
    dataset.score,
    dataset.size,
    dataset.access,
    JSON.stringify(dataset.variables),
    dataset.url,
    JSON.stringify(dataset.tags),
    dataset.accent,
    dataset.id,
  ) as StatementResultingChanges;
  return result.changes > 0;
}

export function dbDeleteDataset(id: string): boolean {
  const result = db.prepare("DELETE FROM datasets WHERE id = ?").run(id) as StatementResultingChanges;
  return result.changes > 0;
}

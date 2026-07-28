import { dbCatalogStats, dbDatasetExists, dbDeleteDataset, dbGetDataset, dbInsertDataset, dbListAllDatasets, dbUpdateDataset, type CatalogStats } from "./db";
import { DEFAULT_PAGE_SIZE } from "./pagination";

export { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "./pagination";

export type Dataset = {
  id: string;
  title: string;
  provider: string;
  sourceType: string;
  description: string;
  domain: string;
  country: string;
  period: string;
  formats: string[];
  license: string;
  update: string;
  score: number;
  size: string;
  access: string;
  variables: string[];
  url: string;
  tags: string[];
  accent: string;
};

export type DatasetInput = Omit<Dataset, "id">;

export type PaginatedDatasets = {
  data: Dataset[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type DatasetSearchParams = {
  query?: string;
  format?: string;
  source?: string;
  license?: string;
};

export type { CatalogStats } from "./db";

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "dataset";
}

async function uniqueId(base: string, exists: (id: string) => Promise<boolean>): Promise<string> {
  let candidate = base;
  let suffix = 2;
  while (await exists(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

// Filtre + trie côté serveur sur l'ensemble du catalogue avant de paginer,
// pour que la recherche porte réellement sur tous les datasets (pas
// seulement sur le premier lot chargé par le client).
export async function searchDatasets(params: DatasetSearchParams = {}, page = 1, pageSize = DEFAULT_PAGE_SIZE): Promise<PaginatedDatasets> {
  const words = normalizeSearchText((params.query ?? "").trim()).split(/\s+/).filter(Boolean);

  const all = await dbListAllDatasets();
  const filtered = all.filter((dataset) => {
    const searchable = normalizeSearchText([dataset.title, dataset.provider, dataset.description, dataset.domain, dataset.country, ...dataset.variables].join(" "));
    return (words.length === 0 || words.every((word) => searchable.includes(word))) &&
      (!params.format || dataset.formats.includes(params.format)) &&
      (!params.source || dataset.sourceType === params.source) &&
      (!params.license || dataset.license.includes(params.license));
  }).sort((a, b) => b.score - a.score);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const data = filtered.slice((page - 1) * pageSize, page * pageSize);
  return { data, page, pageSize, total, totalPages };
}

export function listDatasets(page = 1, pageSize = DEFAULT_PAGE_SIZE): Promise<PaginatedDatasets> {
  return searchDatasets({}, page, pageSize);
}

export function getCatalogStats(): Promise<CatalogStats> {
  return dbCatalogStats();
}

export function getDataset(id: string): Promise<Dataset | undefined> {
  return dbGetDataset(id);
}

export async function createDataset(input: DatasetInput & { id?: string }): Promise<Dataset> {
  const base = input.id ? slugify(input.id) : slugify(input.title);
  const id = await uniqueId(base, dbDatasetExists);
  const dataset: Dataset = { ...input, id };
  await dbInsertDataset(dataset);
  return dataset;
}

export async function updateDataset(id: string, input: DatasetInput): Promise<Dataset | undefined> {
  const dataset: Dataset = { ...input, id };
  return (await dbUpdateDataset(dataset)) ? dataset : undefined;
}

export function deleteDataset(id: string): Promise<boolean> {
  return dbDeleteDataset(id);
}

const REQUIRED_STRING_FIELDS = [
  "title", "provider", "sourceType", "description", "domain",
  "country", "period", "license", "update", "size", "access", "url", "accent",
] as const;

const REQUIRED_ARRAY_FIELDS = ["formats", "variables", "tags"] as const;

export function validateDatasetInput(body: unknown): string[] {
  const errors: string[] = [];
  if (typeof body !== "object" || body === null) {
    return ["Le corps de la requête doit être un objet JSON."];
  }
  const record = body as Record<string, unknown>;

  for (const field of REQUIRED_STRING_FIELDS) {
    if (typeof record[field] !== "string" || record[field] === "") {
      errors.push(`Le champ "${field}" est requis et doit être une chaîne non vide.`);
    }
  }
  for (const field of REQUIRED_ARRAY_FIELDS) {
    const value = record[field];
    if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
      errors.push(`Le champ "${field}" est requis et doit être un tableau de chaînes.`);
    }
  }
  if (typeof record.score !== "number" || Number.isNaN(record.score) || record.score < 0 || record.score > 100) {
    errors.push('Le champ "score" est requis et doit être un nombre entre 0 et 100.');
  }
  return errors;
}

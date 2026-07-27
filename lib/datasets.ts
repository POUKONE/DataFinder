import { dbCountDatasets, dbDatasetExists, dbDeleteDataset, dbGetDataset, dbInsertDataset, dbListDatasets, dbUpdateDataset } from "./db";
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

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "dataset";
}

function uniqueId(base: string, exists: (id: string) => boolean): string {
  let candidate = base;
  let suffix = 2;
  while (exists(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

export function listDatasets(page = 1, pageSize = DEFAULT_PAGE_SIZE): PaginatedDatasets {
  const total = dbCountDatasets();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const data = dbListDatasets({ limit: pageSize, offset: (page - 1) * pageSize });
  return { data, page, pageSize, total, totalPages };
}

export function getDataset(id: string): Dataset | undefined {
  return dbGetDataset(id);
}

export function createDataset(input: DatasetInput & { id?: string }): Dataset {
  const base = input.id ? slugify(input.id) : slugify(input.title);
  const id = uniqueId(base, dbDatasetExists);
  const dataset: Dataset = { ...input, id };
  dbInsertDataset(dataset);
  return dataset;
}

export function updateDataset(id: string, input: DatasetInput): Dataset | undefined {
  const dataset: Dataset = { ...input, id };
  return dbUpdateDataset(dataset) ? dataset : undefined;
}

export function deleteDataset(id: string): boolean {
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

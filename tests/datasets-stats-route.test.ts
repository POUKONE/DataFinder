import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";

process.env.DATAFINDER_DB_PATH = ":memory:";

const { GET } = await import("../app/api/datasets/stats/route");
const { createDataset, deleteDataset, listDatasets, MAX_PAGE_SIZE } = await import("../lib/datasets");
type DatasetInput = import("../lib/datasets").DatasetInput;

function resetDatasets() {
  for (const dataset of listDatasets(1, MAX_PAGE_SIZE).data) deleteDataset(dataset.id);
}

function makeInput(overrides: Partial<DatasetInput> = {}): DatasetInput {
  return {
    title: "Exemple", provider: "Provider", sourceType: "API", description: "Description",
    domain: "Test", country: "France", period: "2026", formats: ["CSV"], license: "CC BY 4.0",
    update: "Ponctuelle", score: 50, size: "1 Mo", access: "API", variables: ["a"],
    url: "https://example.com", tags: ["Test"], accent: "#123456",
    ...overrides,
  };
}

describe("GET /api/datasets/stats", () => {
  beforeEach(resetDatasets);

  test("compte les datasets, fournisseurs, domaines et licences distincts", async () => {
    createDataset({ ...makeInput({ provider: "A", domain: "Économie", license: "CC BY 4.0" }), id: "d1" });
    createDataset({ ...makeInput({ provider: "A", domain: "Santé", license: "CC BY 4.0" }), id: "d2" });
    createDataset({ ...makeInput({ provider: "B", domain: "Santé", license: "ODbL" }), id: "d3" });

    const response = GET();
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.datasets, 3);
    assert.equal(body.providers, 2);
    assert.equal(body.domains, 2);
    assert.equal(body.licenses, 2);
  });

  test("renvoie des zéros sur un catalogue vide", async () => {
    const response = GET();
    const body = await response.json();
    assert.deepEqual(body, { datasets: 0, providers: 0, domains: 0, licenses: 0 });
  });
});

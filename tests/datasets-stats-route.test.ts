import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";

const { GET } = await import("../app/api/datasets/stats/route");
const { createDataset, deleteDataset, listDatasets, MAX_PAGE_SIZE } = await import("../lib/datasets");
type DatasetInput = import("../lib/datasets").DatasetInput;

async function resetDatasets() {
  while (true) {
    const { data } = await listDatasets(1, MAX_PAGE_SIZE);
    if (data.length === 0) break;
    for (const dataset of data) await deleteDataset(dataset.id);
  }
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
    await createDataset({ ...makeInput({ provider: "A", domain: "Économie", license: "CC BY 4.0" }), id: "d1" });
    await createDataset({ ...makeInput({ provider: "A", domain: "Santé", license: "CC BY 4.0" }), id: "d2" });
    await createDataset({ ...makeInput({ provider: "B", domain: "Santé", license: "ODbL" }), id: "d3" });

    const response = await GET();
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.datasets, 3);
    assert.equal(body.providers, 2);
    assert.equal(body.domains, 2);
    assert.equal(body.licenses, 2);
  });

  test("renvoie des zéros sur un catalogue vide", async () => {
    const response = await GET();
    const body = await response.json();
    assert.deepEqual(body, { datasets: 0, providers: 0, domains: 0, licenses: 0 });
  });
});

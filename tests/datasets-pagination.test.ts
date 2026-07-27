import assert from "node:assert/strict";
import { before, beforeEach, describe, test } from "node:test";

process.env.DATAFINDER_DB_PATH = ":memory:";

const { createDataset, deleteDataset, DEFAULT_PAGE_SIZE, listDatasets, MAX_PAGE_SIZE } = await import("../lib/datasets");
type DatasetInput = import("../lib/datasets").DatasetInput;

function makeInput(overrides: Partial<DatasetInput> = {}): DatasetInput {
  return {
    title: "Exemple Dataset",
    provider: "Exemple Provider",
    sourceType: "API",
    description: "Un dataset d'exemple pour les tests.",
    domain: "Test",
    country: "France",
    period: "2026",
    formats: ["CSV"],
    license: "CC BY 4.0",
    update: "Ponctuelle",
    score: 50,
    size: "1 Mo",
    access: "API",
    variables: ["a"],
    url: "https://example.com",
    tags: ["Test"],
    accent: "#123456",
    ...overrides,
  };
}

function resetDatasets() {
  for (const dataset of listDatasets(1, MAX_PAGE_SIZE).data) {
    deleteDataset(dataset.id);
  }
}

// Ids/scores choisis pour un tri par score descendant prévisible : p1 (90) > p2 (70) > p3 (50).
function seedThree() {
  resetDatasets();
  createDataset({ ...makeInput({ score: 50 }), id: "p3" });
  createDataset({ ...makeInput({ score: 90 }), id: "p1" });
  createDataset({ ...makeInput({ score: 70 }), id: "p2" });
}

describe("listDatasets - valeurs par défaut", () => {
  beforeEach(seedThree);

  test("utilise page=1 et pageSize=DEFAULT_PAGE_SIZE par défaut", () => {
    const result = listDatasets();
    assert.equal(result.page, 1);
    assert.equal(result.pageSize, DEFAULT_PAGE_SIZE);
    assert.equal(result.total, 3);
    assert.equal(result.totalPages, 1);
    assert.equal(result.data.length, 3);
  });

  test("trie les résultats par score décroissant", () => {
    const { data } = listDatasets(1, MAX_PAGE_SIZE);
    assert.deepEqual(data.map((d) => d.id), ["p1", "p2", "p3"]);
  });
});

describe("listDatasets - découpage en pages", () => {
  beforeEach(seedThree);

  test("renvoie la bonne tranche pour page=1 pageSize=2", () => {
    const result = listDatasets(1, 2);
    assert.deepEqual(result.data.map((d) => d.id), ["p1", "p2"]);
    assert.equal(result.total, 3);
    assert.equal(result.totalPages, 2);
  });

  test("renvoie la bonne tranche pour page=2 pageSize=2", () => {
    const result = listDatasets(2, 2);
    assert.deepEqual(result.data.map((d) => d.id), ["p3"]);
    assert.equal(result.totalPages, 2);
  });

  test("renvoie un tableau vide pour une page au-delà des résultats", () => {
    const result = listDatasets(99, 2);
    assert.deepEqual(result.data, []);
    assert.equal(result.total, 3);
    assert.equal(result.totalPages, 2);
    assert.equal(result.page, 99);
  });
});

describe("listDatasets - catalogue vide", () => {
  before(resetDatasets);

  test("totalPages vaut au moins 1 même sans données", () => {
    const result = listDatasets(1, 10);
    assert.equal(result.total, 0);
    assert.equal(result.totalPages, 1);
    assert.deepEqual(result.data, []);
  });
});

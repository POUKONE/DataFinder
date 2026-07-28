import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";

const { createDataset, deleteDataset, listDatasets, MAX_PAGE_SIZE, searchDatasets } = await import("../lib/datasets");
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

async function resetDatasets() {
  while (true) {
    const { data } = await listDatasets(1, MAX_PAGE_SIZE);
    if (data.length === 0) break;
    for (const dataset of data) await deleteDataset(dataset.id);
  }
}

async function seedCatalog() {
  await resetDatasets();
  await createDataset({
    ...makeInput({ title: "Chômage des jeunes", description: "Taux de chômage.", sourceType: "Institution", license: "CC BY 4.0", formats: ["API", "CSV"], score: 90 }),
    id: "chomage",
  });
  await createDataset({
    ...makeInput({ title: "Recensement de la population", description: "Démographie française.", sourceType: "Gouvernement", license: "Licence Ouverte 2.0", formats: ["CSV"], score: 70 }),
    id: "recensement",
  });
  await createDataset({
    ...makeInput({ title: "Trafic Vélib", description: "Disponibilité des stations.", sourceType: "API", license: "ODbL", formats: ["JSON"], score: 50 }),
    id: "velib",
  });
}

describe("searchDatasets - recherche texte", () => {
  beforeEach(seedCatalog);

  test("sans requête, renvoie tout le catalogue trié par score", async () => {
    const result = await searchDatasets({});
    assert.deepEqual(result.data.map((d) => d.id), ["chomage", "recensement", "velib"]);
    assert.equal(result.total, 3);
  });

  test("filtre par mot-clé sur le titre", async () => {
    const result = await searchDatasets({ query: "vélib" });
    assert.deepEqual(result.data.map((d) => d.id), ["velib"]);
  });

  test("ignore les accents (chomage matche Chômage)", async () => {
    const result = await searchDatasets({ query: "chomage" });
    assert.deepEqual(result.data.map((d) => d.id), ["chomage"]);
  });

  test("recherche multi-mots, peu importe l'ordre", async () => {
    const result = await searchDatasets({ query: "population recensement" });
    assert.deepEqual(result.data.map((d) => d.id), ["recensement"]);
  });

  test("aucun résultat si un des mots ne matche rien", async () => {
    const result = await searchDatasets({ query: "chomage inexistant" });
    assert.deepEqual(result.data, []);
    assert.equal(result.total, 0);
  });
});

describe("searchDatasets - filtres", () => {
  beforeEach(seedCatalog);

  test("filtre par format", async () => {
    const result = await searchDatasets({ format: "JSON" });
    assert.deepEqual(result.data.map((d) => d.id), ["velib"]);
  });

  test("filtre par source", async () => {
    const result = await searchDatasets({ source: "Gouvernement" });
    assert.deepEqual(result.data.map((d) => d.id), ["recensement"]);
  });

  test("filtre par licence (correspondance partielle)", async () => {
    const result = await searchDatasets({ license: "CC BY" });
    assert.deepEqual(result.data.map((d) => d.id), ["chomage"]);
  });

  test("combine requête texte et filtres", async () => {
    const result = await searchDatasets({ query: "des", source: "Institution" });
    assert.deepEqual(result.data.map((d) => d.id), ["chomage"]);
  });
});

describe("searchDatasets - pagination sur résultats filtrés", () => {
  beforeEach(seedCatalog);

  test("total/totalPages reflètent le sous-ensemble filtré, pas tout le catalogue", async () => {
    const result = await searchDatasets({ format: "CSV" }, 1, 1);
    assert.equal(result.total, 2);
    assert.equal(result.totalPages, 2);
    assert.deepEqual(result.data.map((d) => d.id), ["chomage"]);
  });
});

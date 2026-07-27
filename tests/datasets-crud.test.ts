import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";

process.env.DATAFINDER_DB_PATH = ":memory:";

const { createDataset, deleteDataset, getDataset, listDatasets, MAX_PAGE_SIZE, updateDataset, validateDatasetInput } =
  await import("../lib/datasets");
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

describe("createDataset", () => {
  beforeEach(resetDatasets);

  test("génère un id slugifié à partir du titre quand aucun id n'est fourni", () => {
    const dataset = createDataset(makeInput({ title: "Recensement Général 2026 !" }));
    assert.equal(dataset.id, "recensement-general-2026");
  });

  test("slugifie l'id fourni explicitement", () => {
    const dataset = createDataset({ ...makeInput(), id: "Mon ID Perso" });
    assert.equal(dataset.id, "mon-id-perso");
  });

  test("dé-duplique les ids en collision avec un suffixe numérique", () => {
    const first = createDataset({ ...makeInput(), id: "doublon" });
    const second = createDataset({ ...makeInput(), id: "doublon" });
    const third = createDataset({ ...makeInput(), id: "doublon" });
    assert.equal(first.id, "doublon");
    assert.equal(second.id, "doublon-2");
    assert.equal(third.id, "doublon-3");
  });

  test("persiste le dataset, consultable ensuite via getDataset", () => {
    const created = createDataset(makeInput({ title: "Persisté" }));
    assert.deepEqual(getDataset(created.id), created);
  });
});

describe("getDataset", () => {
  beforeEach(resetDatasets);

  test("retourne undefined pour un id inconnu", () => {
    assert.equal(getDataset("inconnu"), undefined);
  });
});

describe("updateDataset", () => {
  beforeEach(resetDatasets);

  test("remplace les champs en conservant le même id", () => {
    const created = createDataset(makeInput({ title: "Avant", score: 10 }));
    const updated = updateDataset(created.id, makeInput({ title: "Après", score: 90 }));
    assert.equal(updated?.id, created.id);
    assert.equal(updated?.title, "Après");
    assert.equal(updated?.score, 90);
    assert.equal(getDataset(created.id)?.title, "Après");
  });

  test("retourne undefined et ne crée pas de ligne pour un id inconnu", () => {
    const result = updateDataset("inconnu", makeInput());
    assert.equal(result, undefined);
    assert.equal(getDataset("inconnu"), undefined);
  });
});

describe("deleteDataset", () => {
  beforeEach(resetDatasets);

  test("supprime un dataset existant et retourne true", () => {
    const created = createDataset(makeInput());
    assert.equal(deleteDataset(created.id), true);
    assert.equal(getDataset(created.id), undefined);
  });

  test("retourne false pour un id inconnu", () => {
    assert.equal(deleteDataset("inconnu"), false);
  });
});

describe("validateDatasetInput", () => {
  test("accepte un input valide (aucune erreur)", () => {
    assert.deepEqual(validateDatasetInput(makeInput()), []);
  });

  test("rejette un corps qui n'est pas un objet", () => {
    assert.deepEqual(validateDatasetInput(null), ["Le corps de la requête doit être un objet JSON."]);
    assert.deepEqual(validateDatasetInput("chaine"), ["Le corps de la requête doit être un objet JSON."]);
  });

  test("signale chaque champ chaîne requis manquant ou vide", () => {
    const errors = validateDatasetInput({ ...makeInput(), title: "", provider: undefined });
    assert.ok(errors.some((message) => message.includes('"title"')));
    assert.ok(errors.some((message) => message.includes('"provider"')));
  });

  test("signale les champs tableau invalides", () => {
    const errors = validateDatasetInput({ ...makeInput(), formats: "CSV", tags: [1, 2] });
    assert.ok(errors.some((message) => message.includes('"formats"')));
    assert.ok(errors.some((message) => message.includes('"tags"')));
  });

  test("signale un score hors de l'intervalle 0-100", () => {
    assert.ok(validateDatasetInput({ ...makeInput(), score: 150 }).some((m) => m.includes('"score"')));
    assert.ok(validateDatasetInput({ ...makeInput(), score: -1 }).some((m) => m.includes('"score"')));
    assert.ok(validateDatasetInput({ ...makeInput(), score: "80" }).some((m) => m.includes('"score"')));
  });
});

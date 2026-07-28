import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";

process.env.DATAFINDER_API_KEY = "test-admin-key";

const { GET: listGET, POST: listPOST } = await import("../app/api/datasets/route");
const { GET: itemGET, PUT: itemPUT, DELETE: itemDELETE } = await import("../app/api/datasets/[id]/route");
const { listDatasets, deleteDataset, MAX_PAGE_SIZE } = await import("../lib/datasets");
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

function withParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/datasets", () => {
  beforeEach(resetDatasets);

  test("retourne 400 pour un paramètre page invalide", async () => {
    const response = await listGET(new Request("http://localhost/api/datasets?page=0"));
    assert.equal(response.status, 400);
  });

  test("retourne la liste paginée par défaut", async () => {
    const response = await listGET(new Request("http://localhost/api/datasets"));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.total, 0);
  });

  test("le paramètre q filtre les résultats", async () => {
    await listPOST(new Request("http://localhost/api/datasets", {
      method: "POST",
      headers: { Authorization: "Bearer test-admin-key" },
      body: JSON.stringify(makeInput({ title: "Chômage des jeunes" })),
    }));
    await listPOST(new Request("http://localhost/api/datasets", {
      method: "POST",
      headers: { Authorization: "Bearer test-admin-key" },
      body: JSON.stringify(makeInput({ title: "Météo historique" })),
    }));

    const response = await listGET(new Request("http://localhost/api/datasets?q=chomage"));
    const body = await response.json();
    assert.equal(body.total, 1);
    assert.equal(body.data[0].title, "Chômage des jeunes");
  });
});

describe("POST /api/datasets", () => {
  beforeEach(resetDatasets);

  test("retourne 401 sans clé API", async () => {
    const response = await listPOST(new Request("http://localhost/api/datasets", {
      method: "POST",
      body: JSON.stringify(makeInput()),
    }));
    assert.equal(response.status, 401);
  });

  test("retourne 400 pour un JSON invalide", async () => {
    const response = await listPOST(new Request("http://localhost/api/datasets", {
      method: "POST",
      headers: { Authorization: "Bearer test-admin-key" },
      body: "{ invalide",
    }));
    assert.equal(response.status, 400);
  });

  test("retourne 400 avec le détail des erreurs de validation", async () => {
    const response = await listPOST(new Request("http://localhost/api/datasets", {
      method: "POST",
      headers: { Authorization: "Bearer test-admin-key" },
      body: JSON.stringify({}),
    }));
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.ok(Array.isArray(body.details));
    assert.ok(body.details.length > 0);
  });

  test("crée un dataset avec une clé valide et un corps valide", async () => {
    const response = await listPOST(new Request("http://localhost/api/datasets", {
      method: "POST",
      headers: { Authorization: "Bearer test-admin-key" },
      body: JSON.stringify(makeInput({ title: "Nouveau dataset" })),
    }));
    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.id, "nouveau-dataset");
  });
});

describe("GET/PUT/DELETE /api/datasets/[id]", () => {
  beforeEach(resetDatasets);

  test("GET retourne 404 pour un id inconnu", async () => {
    const response = await itemGET(new Request("http://localhost/api/datasets/inconnu"), withParams("inconnu"));
    assert.equal(response.status, 404);
  });

  test("PUT retourne 401 sans clé API", async () => {
    const response = await itemPUT(new Request("http://localhost/api/datasets/inconnu", {
      method: "PUT",
      body: JSON.stringify(makeInput()),
    }), withParams("inconnu"));
    assert.equal(response.status, 401);
  });

  test("DELETE retourne 401 sans clé API", async () => {
    const response = await itemDELETE(new Request("http://localhost/api/datasets/inconnu", { method: "DELETE" }), withParams("inconnu"));
    assert.equal(response.status, 401);
  });

  test("cycle complet : créer, lire, modifier, supprimer", async () => {
    const created = await listPOST(new Request("http://localhost/api/datasets", {
      method: "POST",
      headers: { Authorization: "Bearer test-admin-key" },
      body: JSON.stringify(makeInput({ title: "Cycle complet" })),
    })).then((r) => r.json());

    const got = await itemGET(new Request(`http://localhost/api/datasets/${created.id}`), withParams(created.id));
    assert.equal(got.status, 200);

    const updated = await itemPUT(new Request(`http://localhost/api/datasets/${created.id}`, {
      method: "PUT",
      headers: { Authorization: "Bearer test-admin-key" },
      body: JSON.stringify(makeInput({ title: "Cycle modifié" })),
    }), withParams(created.id));
    assert.equal(updated.status, 200);
    const updatedBody = await updated.json();
    assert.equal(updatedBody.title, "Cycle modifié");

    const deleted = await itemDELETE(new Request(`http://localhost/api/datasets/${created.id}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer test-admin-key" },
    }), withParams(created.id));
    assert.equal(deleted.status, 204);

    const afterDelete = await itemGET(new Request(`http://localhost/api/datasets/${created.id}`), withParams(created.id));
    assert.equal(afterDelete.status, 404);
  });
});

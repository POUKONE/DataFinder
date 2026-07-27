import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";

const { searchWeb } = await import("../lib/webSearch");

const ORIGINAL_KEY = process.env.BRAVE_SEARCH_API_KEY;
const originalFetch = globalThis.fetch;

beforeEach(() => {
  process.env.BRAVE_SEARCH_API_KEY = "test-brave-key";
});

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.BRAVE_SEARCH_API_KEY;
  else process.env.BRAVE_SEARCH_API_KEY = ORIGINAL_KEY;
  globalThis.fetch = originalFetch;
});

function mockFetch(response: Partial<Response> & { json?: () => Promise<unknown> }) {
  globalThis.fetch = (async () => response as Response) as typeof fetch;
}

describe("searchWeb", () => {
  test("lève une erreur si BRAVE_SEARCH_API_KEY n'est pas configurée", async () => {
    delete process.env.BRAVE_SEARCH_API_KEY;
    await assert.rejects(() => searchWeb("test"), /BRAVE_SEARCH_API_KEY/);
  });

  test("lève une erreur si Brave répond avec un statut non-ok", async () => {
    mockFetch({ ok: false, status: 500 });
    await assert.rejects(() => searchWeb("test"), /500/);
  });

  test("filtre les résultats sans titre ou sans url, et nettoie le HTML", async () => {
    mockFetch({
      ok: true,
      json: async () => ({
        web: {
          results: [
            { title: "<strong>Titre</strong> propre", url: "https://example.com/a", description: "Une <em>description</em>." },
            { title: "Sans URL" },
            { url: "https://example.com/b" },
          ],
        },
      }),
    });

    const results = await searchWeb("test");
    assert.deepEqual(results, [
      { title: "Titre propre", url: "https://example.com/a", description: "Une description." },
    ]);
  });

  test("retourne un tableau vide si la réponse Brave n'a pas de résultats", async () => {
    mockFetch({ ok: true, json: async () => ({}) });
    const results = await searchWeb("test");
    assert.deepEqual(results, []);
  });
});

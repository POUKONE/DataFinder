import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";

process.env.WEB_SEARCH_RATE_LIMIT = "3";
process.env.WEB_SEARCH_RATE_WINDOW_MS = "60000";

const { GET } = await import("../app/api/web-search/route");

const originalFetch = globalThis.fetch;
const ORIGINAL_KEY = process.env.BRAVE_SEARCH_API_KEY;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (ORIGINAL_KEY === undefined) delete process.env.BRAVE_SEARCH_API_KEY;
  else process.env.BRAVE_SEARCH_API_KEY = ORIGINAL_KEY;
});

function request(query: string, ip: string) {
  return new Request(`http://localhost/api/web-search?q=${encodeURIComponent(query)}`, {
    headers: { "x-forwarded-for": ip },
  });
}

describe("GET /api/web-search", () => {
  test("retourne 400 si le paramètre q est absent", async () => {
    const response = await GET(new Request("http://localhost/api/web-search", { headers: { "x-forwarded-for": "1.1.1.1" } }));
    assert.equal(response.status, 400);
  });

  test("retourne 503 si BRAVE_SEARCH_API_KEY n'est pas configurée", async () => {
    delete process.env.BRAVE_SEARCH_API_KEY;
    const response = await GET(request("test", "2.2.2.2"));
    assert.equal(response.status, 503);
  });

  test("retourne les résultats quand tout est configuré", async () => {
    process.env.BRAVE_SEARCH_API_KEY = "test-key";
    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({ web: { results: [{ title: "T", url: "https://data.gouv.fr/x", description: "D" }] } }),
    })) as typeof fetch;

    const response = await GET(request("test", "3.3.3.3"));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.results.length, 1);
  });

  test("retourne 502 si l'appel à Brave échoue", async () => {
    process.env.BRAVE_SEARCH_API_KEY = "test-key";
    globalThis.fetch = (async () => ({ ok: false, status: 500 })) as typeof fetch;
    const response = await GET(request("test", "4.4.4.4"));
    assert.equal(response.status, 502);
  });

  test("bloque avec 429 et un en-tête Retry-After au-delà de la limite", async () => {
    process.env.BRAVE_SEARCH_API_KEY = "test-key";
    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({ web: { results: [] } }),
    })) as typeof fetch;

    const ip = "5.5.5.5";
    let last;
    for (let i = 0; i < 4; i += 1) last = await GET(request("test", ip));
    assert.equal(last!.status, 429);
    assert.ok(last!.headers.get("Retry-After"));
  });
});

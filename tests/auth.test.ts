import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";

const { checkApiKey } = await import("../lib/auth");

const ORIGINAL_KEY = process.env.DATAFINDER_API_KEY;

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.DATAFINDER_API_KEY;
  else process.env.DATAFINDER_API_KEY = ORIGINAL_KEY;
});

describe("checkApiKey", () => {
  test("retourne 503 si DATAFINDER_API_KEY n'est pas configurée", async () => {
    delete process.env.DATAFINDER_API_KEY;
    const response = checkApiKey(new Request("http://localhost/", { headers: { Authorization: "Bearer anything" } }));
    assert.ok(response);
    assert.equal(response!.status, 503);
    const body = await response!.json();
    assert.match(body.error, /DATAFINDER_API_KEY/);
  });

  test("retourne 401 si l'en-tête Authorization est absent", () => {
    process.env.DATAFINDER_API_KEY = "secret-key";
    const response = checkApiKey(new Request("http://localhost/"));
    assert.ok(response);
    assert.equal(response!.status, 401);
  });

  test("retourne 401 si l'en-tête n'est pas au format \"Bearer <clé>\"", () => {
    process.env.DATAFINDER_API_KEY = "secret-key";
    const response = checkApiKey(new Request("http://localhost/", { headers: { Authorization: "secret-key" } }));
    assert.ok(response);
    assert.equal(response!.status, 401);
  });

  test("retourne 401 si la clé fournie est incorrecte", () => {
    process.env.DATAFINDER_API_KEY = "secret-key";
    const response = checkApiKey(new Request("http://localhost/", { headers: { Authorization: "Bearer wrong-key" } }));
    assert.ok(response);
    assert.equal(response!.status, 401);
  });

  test("retourne null quand la clé fournie est correcte", () => {
    process.env.DATAFINDER_API_KEY = "secret-key";
    const response = checkApiKey(new Request("http://localhost/", { headers: { Authorization: "Bearer secret-key" } }));
    assert.equal(response, null);
  });
});

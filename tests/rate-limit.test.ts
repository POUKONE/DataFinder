import assert from "node:assert/strict";
import test, { describe } from "node:test";

const { checkRateLimit, getClientIp } = await import("../lib/rateLimit");

describe("checkRateLimit", () => {
  test("autorise les requêtes tant que la limite n'est pas dépassée", () => {
    const key = `test-${Math.random()}`;
    assert.deepEqual(checkRateLimit(key, 3, 60_000), { allowed: true });
    assert.deepEqual(checkRateLimit(key, 3, 60_000), { allowed: true });
    assert.deepEqual(checkRateLimit(key, 3, 60_000), { allowed: true });
  });

  test("bloque une fois la limite dépassée, avec un retryAfterSeconds positif", () => {
    const key = `test-${Math.random()}`;
    checkRateLimit(key, 2, 60_000);
    checkRateLimit(key, 2, 60_000);
    const result = checkRateLimit(key, 2, 60_000);
    assert.equal(result.allowed, false);
    if (!result.allowed) {
      assert.ok(result.retryAfterSeconds > 0);
      assert.ok(result.retryAfterSeconds <= 60);
    }
  });

  test("des clés différentes ont des compteurs indépendants", () => {
    const keyA = `test-a-${Math.random()}`;
    const keyB = `test-b-${Math.random()}`;
    assert.deepEqual(checkRateLimit(keyA, 1, 60_000), { allowed: true });
    assert.equal(checkRateLimit(keyA, 1, 60_000).allowed, false);
    assert.deepEqual(checkRateLimit(keyB, 1, 60_000), { allowed: true });
  });

  test("réinitialise le compteur une fois la fenêtre expirée", async () => {
    const key = `test-${Math.random()}`;
    assert.deepEqual(checkRateLimit(key, 1, 20), { allowed: true });
    assert.equal(checkRateLimit(key, 1, 20).allowed, false);
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.deepEqual(checkRateLimit(key, 1, 20), { allowed: true });
  });
});

describe("getClientIp", () => {
  test("utilise x-forwarded-for en priorité, en gardant la première IP", () => {
    const request = new Request("http://localhost/", {
      headers: { "x-forwarded-for": "203.0.113.5, 10.0.0.1", "x-real-ip": "198.51.100.9" },
    });
    assert.equal(getClientIp(request), "203.0.113.5");
  });

  test("retombe sur x-real-ip si x-forwarded-for est absent", () => {
    const request = new Request("http://localhost/", { headers: { "x-real-ip": "198.51.100.9" } });
    assert.equal(getClientIp(request), "198.51.100.9");
  });

  test("retombe sur \"unknown\" si aucun en-tête n'est présent", () => {
    const request = new Request("http://localhost/");
    assert.equal(getClientIp(request), "unknown");
  });
});

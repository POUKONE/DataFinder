import assert from "node:assert/strict";
import test from "node:test";

process.env.DATAFINDER_DB_PATH = ":memory:";

const { GET } = await import("../app/api/health/route");

test("GET /api/health retourne 200 et status ok quand la base répond", async () => {
  const response = GET();
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.status, "ok");
  assert.equal(body.database, "ok");
  assert.equal(body.service, "datafinder");
  assert.ok(body.timestamp);
});

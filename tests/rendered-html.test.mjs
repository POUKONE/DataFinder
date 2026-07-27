import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("contient les surfaces principales de DataFinder", async () => {
  const [page, layout, dockerfile, seed, db, apiRoute] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../Dockerfile", import.meta.url), "utf8"),
    readFile(new URL("../lib/seed.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/db.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/datasets/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(page, /Les bonnes données/);
  assert.match(page, /\/api\/datasets/);
  assert.match(page, /Comparer maintenant/);
  assert.match(seed, /Demandes de valeurs foncières/);
  assert.match(db, /node:sqlite/);
  assert.match(apiRoute, /GET/);
  assert.match(layout, /DATAFINDER_PUBLIC_URL/);
  assert.match(dockerfile, /\.next\/standalone/);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("contient les surfaces principales de DataFinder", async () => {
  const [page, layout, dockerfile] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../Dockerfile", import.meta.url), "utf8"),
  ]);
  assert.match(page, /Les bonnes données/);
  assert.match(page, /Demandes de valeurs foncières/);
  assert.match(page, /Comparer maintenant/);
  assert.match(layout, /DATAFINDER_PUBLIC_URL/);
  assert.match(dockerfile, /\.next\/standalone/);
});

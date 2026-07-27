import { createHash, timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string): boolean {
  const digestA = createHash("sha256").update(a).digest();
  const digestB = createHash("sha256").update(b).digest();
  return timingSafeEqual(digestA, digestB);
}

export function checkApiKey(request: Request): Response | null {
  const configuredKey = process.env.DATAFINDER_API_KEY;
  if (!configuredKey) {
    return Response.json(
      { error: "DATAFINDER_API_KEY n'est pas configurée sur le serveur." },
      { status: 503 },
    );
  }

  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  if (!provided || !safeEqual(provided, configuredKey)) {
    return Response.json({ error: "Clé API manquante ou invalide." }, { status: 401 });
  }

  return null;
}

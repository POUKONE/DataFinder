import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { searchWeb } from "@/lib/webSearch";

export const dynamic = "force-dynamic";

const RATE_LIMIT = Number(process.env.WEB_SEARCH_RATE_LIMIT) || 10;
const RATE_WINDOW_MS = Number(process.env.WEB_SEARCH_RATE_WINDOW_MS) || 60_000;

export async function GET(request: Request) {
  const clientIp = getClientIp(request);
  const rate = checkRateLimit(`web-search:${clientIp}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!rate.allowed) {
    return Response.json(
      { error: "Trop de requêtes de recherche web. Réessayez plus tard." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  if (!query) {
    return Response.json({ error: 'Le paramètre "q" est requis.' }, { status: 400 });
  }
  if (!process.env.BRAVE_SEARCH_API_KEY) {
    return Response.json({ error: "La recherche web n'est pas configurée (BRAVE_SEARCH_API_KEY manquante)." }, { status: 503 });
  }

  try {
    const results = await searchWeb(query);
    return Response.json({ query, results });
  } catch {
    return Response.json({ error: "La recherche web a échoué." }, { status: 502 });
  }
}

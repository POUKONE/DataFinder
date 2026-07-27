export type WebResult = {
  title: string;
  url: string;
  description: string;
};

const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const isHex = entity[1]?.toLowerCase() === "x";
      const codePoint = parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint);
    }
    return HTML_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

function cleanText(value: string): string {
  return decodeHtmlEntities(value.replace(/<\/?[^>]+(>|$)/g, ""));
}

const DATASET_DOMAINS = [
  "data.gouv.fr",
  "data.gov",
  "data.europa.eu",
  "data.gov.uk",
  "opendata.swiss",
  "kaggle.com",
  "huggingface.co",
  "zenodo.org",
  "archive.ics.uci.edu",
  "paperswithcode.com",
  "data.worldbank.org",
  "ec.europa.eu",
  "data.world",
  "ourworldindata.org",
  "github.com",
];

const DATASET_SITE_FILTER = `(${DATASET_DOMAINS.map((domain) => `site:${domain}`).join(" OR ")})`;

export async function searchWeb(query: string): Promise<WebResult[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) throw new Error("BRAVE_SEARCH_API_KEY n'est pas configurée.");

  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", `${query} ${DATASET_SITE_FILTER}`);
  url.searchParams.set("count", "10");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": apiKey,
    },
  });

  if (!response.ok) throw new Error(`Brave Search API a répondu ${response.status}.`);

  const data = await response.json();
  const rawResults = (data?.web?.results ?? []) as Array<{ title?: string; url?: string; description?: string }>;

  return rawResults
    .filter((item) => item.title && item.url)
    .map((item) => ({
      title: cleanText(item.title!),
      url: item.url!,
      description: cleanText(item.description ?? ""),
    }));
}

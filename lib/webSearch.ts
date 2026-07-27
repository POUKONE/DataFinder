export type WebResult = {
  title: string;
  url: string;
  description: string;
};

function stripHtml(value: string): string {
  return value.replace(/<\/?[^>]+(>|$)/g, "");
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
      title: stripHtml(item.title!),
      url: item.url!,
      description: stripHtml(item.description ?? ""),
    }));
}

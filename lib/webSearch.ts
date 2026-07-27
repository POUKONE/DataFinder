export type WebResult = {
  title: string;
  url: string;
  description: string;
};

function stripHtml(value: string): string {
  return value.replace(/<\/?[^>]+(>|$)/g, "");
}

const DATASET_BIAS = '(dataset OR database OR "open data" OR "jeu de données" OR "base de données")';

export async function searchWeb(query: string): Promise<WebResult[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) throw new Error("BRAVE_SEARCH_API_KEY n'est pas configurée.");

  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", `${query} ${DATASET_BIAS}`);
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

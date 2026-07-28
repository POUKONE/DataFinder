import { checkApiKey } from "@/lib/auth";
import { createDataset, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, searchDatasets, validateDatasetInput, type DatasetInput } from "@/lib/datasets";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pageParam = searchParams.get("page");
  const pageSizeParam = searchParams.get("pageSize");

  const page = pageParam === null ? 1 : Number(pageParam);
  const pageSize = pageSizeParam === null ? DEFAULT_PAGE_SIZE : Number(pageSizeParam);

  if (!Number.isInteger(page) || page < 1) {
    return Response.json({ error: 'Le paramètre "page" doit être un entier supérieur ou égal à 1.' }, { status: 400 });
  }
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    return Response.json({ error: 'Le paramètre "pageSize" doit être un entier supérieur ou égal à 1.' }, { status: 400 });
  }

  const params = {
    query: searchParams.get("q") ?? undefined,
    format: searchParams.get("format") ?? undefined,
    source: searchParams.get("source") ?? undefined,
    license: searchParams.get("license") ?? undefined,
  };

  return Response.json(await searchDatasets(params, page, Math.min(pageSize, MAX_PAGE_SIZE)));
}

export async function POST(request: Request) {
  const unauthorized = checkApiKey(request);
  if (unauthorized) return unauthorized;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const errors = validateDatasetInput(body);
  if (errors.length > 0) {
    return Response.json({ error: "Validation échouée.", details: errors }, { status: 400 });
  }

  const dataset = await createDataset(body as DatasetInput & { id?: string });
  return Response.json(dataset, { status: 201 });
}

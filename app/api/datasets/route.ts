import { createDataset, listDatasets, validateDatasetInput, type DatasetInput } from "@/lib/datasets";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(listDatasets());
}

export async function POST(request: Request) {
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

  const dataset = createDataset(body as DatasetInput & { id?: string });
  return Response.json(dataset, { status: 201 });
}

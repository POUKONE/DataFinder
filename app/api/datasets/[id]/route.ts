import { checkApiKey } from "@/lib/auth";
import { deleteDataset, getDataset, updateDataset, validateDatasetInput, type DatasetInput } from "@/lib/datasets";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const dataset = getDataset(id);
  if (!dataset) return Response.json({ error: "Dataset introuvable." }, { status: 404 });
  return Response.json(dataset);
}

export async function PUT(request: Request, { params }: RouteContext) {
  const unauthorized = checkApiKey(request);
  if (unauthorized) return unauthorized;

  const { id } = await params;

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

  const updated = updateDataset(id, body as DatasetInput);
  if (!updated) return Response.json({ error: "Dataset introuvable." }, { status: 404 });
  return Response.json(updated);
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const unauthorized = checkApiKey(request);
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const deleted = deleteDataset(id);
  if (!deleted) return Response.json({ error: "Dataset introuvable." }, { status: 404 });
  return new Response(null, { status: 204 });
}

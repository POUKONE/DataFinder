import { getCatalogStats } from "@/lib/datasets";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await getCatalogStats());
}

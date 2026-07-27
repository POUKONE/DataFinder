import { getCatalogStats } from "@/lib/datasets";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(getCatalogStats());
}

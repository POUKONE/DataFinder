import { dbHealthCheck } from "@/lib/db";

export const dynamic = "force-dynamic";

export function GET() {
  const dbOk = dbHealthCheck();

  return Response.json(
    {
      status: dbOk ? "ok" : "error",
      service: "datafinder",
      database: dbOk ? "ok" : "unreachable",
      timestamp: new Date().toISOString(),
    },
    { status: dbOk ? 200 : 503 },
  );
}

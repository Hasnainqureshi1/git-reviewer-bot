import { getMissingEnvironmentVariables } from "@/lib/env";

export function GET() {
  const missing = getMissingEnvironmentVariables();
  return Response.json(
    { status: missing.length === 0 ? "ok" : "configuration_required", missing },
    { status: missing.length === 0 ? 200 : 503 },
  );
}

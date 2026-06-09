import { generateOpenApiSpec } from "@/lib/openapi";

export async function GET() {
  return Response.json(generateOpenApiSpec());
}

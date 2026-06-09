import { API_BASE } from "@/lib/constants";
import { endpoints, userJwtEndpoints } from "@/lib/endpoints";

export function generateOpenApiSpec() {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const ep of [...endpoints, ...userJwtEndpoints]) {
    const openPath = ep.path.replace(/\{([^}]+)\}/g, "{$1}");
    if (!paths[openPath]) paths[openPath] = {};
    const tag = ep.path.startsWith("/v1/partner") ? "Partner API" : "User JWT";
    paths[openPath][ep.method.toLowerCase()] = {
      summary: ep.summary,
      tags: [tag],
      ...(ep.scope ? { description: `Scope: ${ep.scope}` } : {}),
      security: ep.path.startsWith("/v1/partner")
        ? [{ partnerApiKey: [] }]
        : [{ userJwt: [] }],
    };
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "Min Partner API (Aare)",
      version: "1.0.0",
      description: "Official OpenAPI description for the Min Partner API and related user JWT routes.",
    },
    servers: [{ url: API_BASE }],
    components: {
      securitySchemes: {
        partnerApiKey: {
          type: "http",
          scheme: "bearer",
          description: "Partner API key ema_pk_...",
        },
        userJwt: {
          type: "http",
          scheme: "bearer",
          description: "User session JWT from POST /v1/partner/users/:id/session",
        },
      },
    },
    paths,
  };
}

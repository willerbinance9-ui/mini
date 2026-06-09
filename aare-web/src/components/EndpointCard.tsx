import { MethodBadge } from "./MethodBadge";
import { ScopeChip } from "./ScopeChip";
import { CodeBlock } from "./CodeBlock";
import type { ApiEndpoint } from "@/lib/endpoints";
import { buildCurl } from "@/lib/endpoints";
import { API_BASE } from "@/lib/constants";

export function EndpointCard({ endpoint }: { endpoint: ApiEndpoint }) {
  const curl = buildCurl(API_BASE, endpoint.method, endpoint.path, "ema_pk_YOUR_KEY", endpoint.bodyTemplate);

  return (
    <article
      id={endpoint.id}
      className="glass card-hover scroll-mt-24 rounded-2xl p-6"
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <MethodBadge method={endpoint.method} />
        <code className="font-mono text-sm text-foreground">{endpoint.path}</code>
        {endpoint.scope ? <ScopeChip scope={endpoint.scope} /> : null}
      </div>
      <p className="mb-4 text-sm text-muted">{endpoint.summary}</p>
      {endpoint.queryParams ? (
        <p className="mb-2 font-mono text-xs text-muted">
          Query: <span className="text-foreground">{endpoint.queryParams}</span>
        </p>
      ) : null}
      {endpoint.bodyTemplate ? (
        <div className="mb-3">
          <p className="mb-1 text-xs font-medium text-foreground">Request body</p>
          <CodeBlock code={endpoint.bodyTemplate} language="json" />
        </div>
      ) : null}
      <CodeBlock code={curl} language="curl" title="curl" />
    </article>
  );
}

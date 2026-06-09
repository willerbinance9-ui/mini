"use client";

import { useEffect, useMemo, useState } from "react";
import { endpoints, type ApiEndpoint } from "@/lib/endpoints";
import { API_BASE } from "@/lib/constants";
import { MethodBadge } from "./MethodBadge";
import { CodeBlock } from "./CodeBlock";

type HistoryEntry = {
  method: string;
  url: string;
  status: number;
  at: string;
};

export function ApiExplorer() {
  const [baseUrl, setBaseUrl] = useState(API_BASE);
  const [apiKey, setApiKey] = useState("");
  const [selectedId, setSelectedId] = useState(endpoints[0]?.id ?? "");
  const [pathValues, setPathValues] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [body, setBody] = useState("");
  const [mockMode, setMockMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<string>("");
  const [status, setStatus] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const endpoint = useMemo(
    () => endpoints.find((e) => e.id === selectedId) ?? endpoints[0],
    [selectedId]
  );

  useEffect(() => {
    const key = sessionStorage.getItem("aare-api-key");
    if (key) setApiKey(key);
  }, []);

  useEffect(() => {
    if (!endpoint) return;
    setQuery(endpoint.queryParams || "");
    setBody(endpoint.bodyTemplate || "");
    const init: Record<string, string> = {};
    endpoint.pathParams?.forEach((p) => {
      init[p] = pathValues[p] || "";
    });
    setPathValues(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint?.id]);

  function resolvedPath(ep: ApiEndpoint) {
    let p = ep.path;
    ep.pathParams?.forEach((param) => {
      p = p.replace(`{${param}}`, pathValues[param] || `{${param}}`);
    });
    return p;
  }

  async function send() {
    if (!endpoint) return;
    const path = resolvedPath(endpoint);
    const url = `${baseUrl.replace(/\/$/, "")}${path}${query ? `?${query}` : ""}`;

    if (mockMode) {
      setStatus(200);
      setResponse(
        JSON.stringify(
          {
            mock: true,
            message: "Mock response — enable Live mode and add your API key",
            endpoint: `${endpoint.method} ${path}`,
          },
          null,
          2
        )
      );
      return;
    }

    if (!apiKey) {
      setStatus(401);
      setResponse(JSON.stringify({ message: "Add your ema_pk_ API key" }, null, 2));
      return;
    }

    sessionStorage.setItem("aare-api-key", apiKey);
    setLoading(true);
    try {
      const init: RequestInit = {
        method: endpoint.method,
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      };
      if (body && endpoint.method !== "GET" && endpoint.method !== "DELETE") {
        init.headers = { ...init.headers, "Content-Type": "application/json" };
        init.body = body;
      }
      const res = await fetch(url, init);
      const text = await res.text();
      setStatus(res.status);
      try {
        setResponse(JSON.stringify(JSON.parse(text), null, 2));
      } catch {
        setResponse(text);
      }
      setHistory((h) =>
        [{ method: endpoint.method, url, status: res.status, at: new Date().toISOString() }, ...h].slice(
          0,
          10
        )
      );
    } catch (e) {
      setStatus(0);
      setResponse(JSON.stringify({ error: String(e) }, null, 2));
    } finally {
      setLoading(false);
    }
  }

  if (!endpoint) return null;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4 rounded-xl border border-card-border p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Request</h2>
          <label className="flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={mockMode}
              onChange={(e) => setMockMode(e.target.checked)}
            />
            Mock mode
          </label>
        </div>

        <label className="block text-xs text-muted">
          API base URL
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className="mt-1 w-full rounded-lg border border-card-border bg-surface px-3 py-2 font-mono text-sm text-foreground"
          />
        </label>

        <label className="block text-xs text-muted">
          Partner API key (session only)
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="ema_pk_..."
            className="mt-1 w-full rounded-lg border border-card-border bg-surface px-3 py-2 font-mono text-sm text-foreground"
          />
        </label>

        <label className="block text-xs text-muted">
          Endpoint
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-card-border bg-surface px-3 py-2 text-sm text-foreground"
          >
            {endpoints.map((e) => (
              <option key={e.id} value={e.id}>
                {e.method} {e.path}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-2 font-mono text-sm">
          <MethodBadge method={endpoint.method} />
          <span className="text-muted">{resolvedPath(endpoint)}</span>
        </div>

        {endpoint.pathParams?.map((param) => (
          <label key={param} className="block text-xs text-muted">
            Path: {param}
            <input
              value={pathValues[param] || ""}
              onChange={(e) => setPathValues((v) => ({ ...v, [param]: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-card-border bg-surface px-3 py-2 font-mono text-sm"
            />
          </label>
        ))}

        {endpoint.method === "GET" || endpoint.queryParams !== undefined ? (
          <label className="block text-xs text-muted">
            Query string (without ?)
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="external_ref=usr_42"
              className="mt-1 w-full rounded-lg border border-card-border bg-surface px-3 py-2 font-mono text-sm"
            />
          </label>
        ) : null}

        {endpoint.method !== "GET" && endpoint.method !== "DELETE" ? (
          <label className="block text-xs text-muted">
            Body (JSON)
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              className="mt-1 w-full rounded-lg border border-card-border bg-surface px-3 py-2 font-mono text-sm"
            />
          </label>
        ) : null}

        <button
          type="button"
          onClick={send}
          disabled={loading}
          className="w-full rounded-full border border-foreground bg-foreground py-3 text-sm font-medium text-background disabled:opacity-60"
        >
          {loading ? "Sending…" : "Send request"}
        </button>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-card-border p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Response</h2>
            {status !== null ? (
              <span
                className={`font-mono text-sm ${status >= 200 && status < 300 ? "text-emerald-400" : "text-rose-400"}`}
              >
                {status || "ERR"}
              </span>
            ) : null}
          </div>
          {response ? (
            <CodeBlock code={response} language="json" title="response" />
          ) : (
            <p className="text-sm text-muted">Send a request to see the response.</p>
          )}
        </div>

        {history.length > 0 ? (
          <div className="rounded-xl border border-card-border p-6">
            <h3 className="mb-2 text-sm font-semibold">Recent requests</h3>
            <ul className="space-y-1 text-xs text-muted">
              {history.map((h, i) => (
                <li key={i} className="font-mono">
                  <span className={h.status < 300 ? "text-emerald-400" : "text-rose-400"}>{h.status}</span>{" "}
                  {h.method} {h.url}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

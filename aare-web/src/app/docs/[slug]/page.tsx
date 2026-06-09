import { notFound } from "next/navigation";
import { docPages } from "@/content/docs-pages";
import { EndpointCard } from "@/components/EndpointCard";
import { endpoints, userJwtEndpoints } from "@/lib/endpoints";

const slugs = Object.keys(docPages);

export function generateStaticParams() {
  return [...slugs, "api-reference"].map((slug) => ({ slug }));
}

export default async function DocSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (slug === "api-reference") {
    return (
      <article className="prose-aare max-w-3xl">
        <h1>API Reference</h1>
        <p>Complete list of Partner API endpoints. Use the API Explorer to send live requests.</p>
        <h2 className="not-prose mt-10 text-xl font-semibold">Partner API</h2>
        <div className="not-prose mt-4 space-y-6">
          {endpoints.map((ep) => (
            <EndpointCard key={ep.id} endpoint={ep} />
          ))}
        </div>
        <h2 className="not-prose mt-12 text-xl font-semibold">User JWT routes</h2>
        <p className="text-muted">
          Mint a session via POST /v1/partner/users/:id/session, then call these with the user JWT.
        </p>
        <div className="not-prose mt-4 space-y-6">
          {userJwtEndpoints.map((ep) => (
            <EndpointCard key={ep.id} endpoint={ep} />
          ))}
        </div>
      </article>
    );
  }

  const page = docPages[slug];
  if (!page) notFound();

  return (
    <article className="prose-aare max-w-3xl">
      <h1>{page.title}</h1>
      <p>{page.description}</p>
      {page.content}
    </article>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (slug === "api-reference") {
    return { title: "API Reference" };
  }
  const page = docPages[slug];
  if (!page) return { title: "Not found" };
  return { title: page.title, description: page.description };
}

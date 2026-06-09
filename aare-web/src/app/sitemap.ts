import type { MetadataRoute } from "next";
import { services } from "@/content/services";
import { docPages } from "@/content/docs-pages";
import { SITE_URL } from "@/lib/constants";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = [
    "",
    "/services",
    "/compare",
    "/pricing",
    "/security",
    "/status",
    "/case-studies",
    "/partnership",
    "/dashboard",
    "/explorer",
    "/docs",
    "/changelog",
    "/webhooks/playground",
  ];

  return [
    ...staticRoutes.map((path) => ({
      url: `${SITE_URL}${path}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: path === "" ? 1 : 0.8,
    })),
    ...services.map((s) => ({
      url: `${SITE_URL}/services/${s.slug}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...Object.keys(docPages).map((slug) => ({
      url: `${SITE_URL}/docs/${slug}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}

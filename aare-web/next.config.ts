import type { NextConfig } from "next";

// Server-side upstream — never use api.aare.cc here until DNS is live.
const backendOrigin = (
  process.env.BACKEND_API_URL || "https://mini-rdjs.onrender.com"
).replace(/\/$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${backendOrigin}/:path*`,
      },
    ];
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This prototype is intentionally mounted as an isolated application under
  // the existing Friday domain. Next.js embeds basePath at build time.
  basePath: "/codebridge",
  output: "standalone",
  poweredByHeader: false,
  // pdfjs-dist resolves its worker relative to import.meta.url. Keeping the
  // package external preserves that relationship in the production server
  // bundle; Turbopack otherwise rewrites it and PDF loading fails at runtime.
  serverExternalPackages: ["pdfjs-dist"],
  outputFileTracingIncludes: {
    "/api/check": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
          {
            key: "Permissions-Policy",
            value: "geolocation=(), microphone=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

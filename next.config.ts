import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // These packages use native Node APIs and must not be bundled by webpack.
  serverExternalPackages: [
    "pdf-parse",
    "tesseract.js",
    "canvas",
    "pdfjs-dist",
  ],

  // Mark 'canvas' as optional — it's a peer dep for scanned PDF OCR.
  // Without it the code path gracefully falls back to OffscreenCanvas.
  turbopack: {
    resolveAlias: {
      canvas: { browser: "./lib/canvas-stub.ts", default: "./lib/canvas-stub.ts" },
    },
  },

  webpack: (config, { isServer }) => {
    // Stub 'canvas' in webpack builds too (standard `next build`)
    if (!isServer) {
      config.resolve = config.resolve || {};
      config.resolve.alias = {
        ...config.resolve.alias,
        canvas: false,
      };
    }
    return config;
  },

  // Security headers applied to all responses.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
      // Allow widget.js to be loaded cross-origin by any website.
      {
        source: "/widget.js",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Cache-Control", value: "public, max-age=300, stale-while-revalidate=3600" },
        ],
      },
      // CORS for the chat API — needed for cross-origin widget requests.
      {
        source: "/api/chat",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type" },
        ],
      },
    ];
  },

  // Redirect the root to the dashboard.
  async redirects() {
    return [
      {
        source: "/",
        destination: "/dashboard",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: [
    "@project-gestion/api",
    "@project-gestion/config",
    "@project-gestion/permissions",
    "@project-gestion/query-keys",
    "@project-gestion/types",
    "@project-gestion/validation",
  ],
  async rewrites() {
    return {
      beforeFiles: [
        {
          // Serve the Firebase Service Worker from the origin root so it can
          // control all pages. The actual handler lives in /api/firebase-sw
          // to get access to NEXT_PUBLIC_* env vars at request time.
          source: "/firebase-messaging-sw.js",
          destination: "/api/firebase-sw",
        },
      ],
    };
  },
};

export default nextConfig;

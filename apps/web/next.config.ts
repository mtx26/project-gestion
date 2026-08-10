import "@project-gestion/config/load-root-env";
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
};

export default nextConfig;

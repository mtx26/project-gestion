import fs from "node:fs";
import path from "node:path";
import { parse } from "dotenv";
import type { NextConfig } from "next";

// Next.js ne charge les .env que depuis le repertoire de l'app (apps/web/),
// jamais depuis la racine du monorepo. Le .env racine est la source commune
// (deja lu explicitement par le backend Django) — on la reprend telle quelle.
const rootEnvPath = path.join(__dirname, "../../.env");
if (fs.existsSync(rootEnvPath)) {
  Object.assign(process.env, parse(fs.readFileSync(rootEnvPath, "utf-8")));
}

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

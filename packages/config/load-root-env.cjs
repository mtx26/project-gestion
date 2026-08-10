/**
 * Charge le `.env` de la racine du monorepo dans `process.env`.
 *
 * Pourquoi ce fichier existe : ni Next.js ni Expo ne lisent les `.env` situes
 * au-dessus de leur propre app — ils ne regardent que `apps/<app>/.env`. Le
 * `.env` racine est pourtant la source unique du projet (le backend Django le
 * lit deja via django-environ). Chaque point d'entree Node cote JS doit donc le
 * charger explicitement, et le faisait en triple avant ce module.
 *
 * A appeler tout en haut des points d'entree Node (config de build, scripts) —
 * jamais depuis du code applicatif : les bundlers y remplacent `process.env.X`
 * par sa valeur au moment du build, il n'y a pas de `.env` a lire a l'execution.
 *
 * CommonJS et extension `.cjs` explicite : ce module est charge par `require()`
 * depuis des fichiers de config (`next.config.ts`, `app.config.js`) avant tout
 * transpileur, et le package est en `"type": "module"`.
 */
const path = require("node:path");

require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

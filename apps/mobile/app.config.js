const path = require("node:path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

/** Schema d'URL attendu par Google sur iOS : le client ID a l'envers.
 * `123-abc.apps.googleusercontent.com` -> `com.googleusercontent.apps.123-abc`
 * (c'est exactement la valeur `REVERSED_CLIENT_ID` du GoogleService-Info.plist).
 * Derive plutot que redemande en variable d'env : une seule source, donc pas
 * de risque de desynchronisation avec le client ID. */
function toReversedClientId(iosClientId) {
  const suffix = ".apps.googleusercontent.com";
  return iosClientId && iosClientId.endsWith(suffix)
    ? `com.googleusercontent.apps.${iosClientId.slice(0, -suffix.length)}`
    : null;
}

// Config dynamique plutot que app.json seul : le plugin Google Sign-In a besoin
// d'un identifiant propre a chaque projet Google Cloud, qui vient donc du .env
// de la racine. Charge ici et pas seulement dans scripts/start.js, pour que
// `expo prebuild`/`eas build` (qui ne passent pas par ce script) le voient aussi.
//
// `config` est le contenu de app.json fourni par Expo — ne jamais le remplacer
// par un `require("./app.json")` : Node mettrait l'objet en cache et les outils
// qui ecrivent dans app.json puis relisent la config dans le meme processus
// (`eas init` et son `extra.eas.projectId`) reliraient une version perimee.
module.exports = ({ config }) => {
  const iosUrlScheme = toReversedClientId(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID);

  // Le plugin n'est branche que si l'identifiant est present : un prebuild sans
  // config Google reste possible.
  return iosUrlScheme
    ? {
        ...config,
        plugins: [
          ...(config.plugins ?? []),
          ["@react-native-google-signin/google-signin", { iosUrlScheme }],
        ],
      }
    : config;
};

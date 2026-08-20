import Constants, { ExecutionEnvironment } from "expo-constants";

type GoogleSignInModule = typeof import("@react-native-google-signin/google-signin");

/** Identifiants OAuth Google (Google Cloud Console). Le client Web est
 * l'audience de l'id_token emis par le SDK natif : c'est lui que le backend
 * verifie, et c'est le meme client que celui utilise par le web. */
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";

/** Expo Go n'embarque que les modules natifs du SDK Expo : `RNGoogleSignin` n'y
 * existe pas. Le simple fait d'importer la librairie appelle
 * `TurboModuleRegistry.getEnforcing` et fait planter l'app au demarrage — d'ou le
 * chargement paresseux plus bas, et ce drapeau qui masque le bouton. Dans un build
 * de dev (`expo-dev-client`) ou de production, le module est bien la. */
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/** Le bouton Google n'est affiche que si la config est presente *et* que le module
 * natif existe — sinon `signIn()` echouerait avec une erreur native peu parlante. */
export const isGoogleSignInAvailable = Boolean(WEB_CLIENT_ID) && !isExpoGo;

let googleModule: GoogleSignInModule | null = null;

/** Charge (et configure) le SDK au premier usage seulement : ce `require` est
 * volontairement dans une fonction, pour qu'aucun code natif ne soit touche tant
 * que l'utilisateur n'a pas appuye sur le bouton. */
function loadGoogleSignIn(): GoogleSignInModule {
  if (!isGoogleSignInAvailable) {
    throw new Error("La connexion Google n'est pas disponible dans cette version de l'application.");
  }
  if (!googleModule) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    googleModule = require("@react-native-google-signin/google-signin") as GoogleSignInModule;
    googleModule.GoogleSignin.configure({
      webClientId: WEB_CLIENT_ID,
      iosClientId: IOS_CLIENT_ID || undefined,
    });
  }
  return googleModule;
}

export const googleWebClientId = WEB_CLIENT_ID;

/** Ouvre le flux natif Google (feuille Safari/Play Services, puis retour dans
 * l'app). Retourne `null` si l'utilisateur annule — un abandon n'est pas une
 * erreur a afficher. */
export async function signInWithGoogle(): Promise<string | null> {
  const { GoogleSignin, isCancelledResponse, isSuccessResponse } = loadGoogleSignIn();

  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();

  if (isCancelledResponse(response)) {
    return null;
  }
  if (!isSuccessResponse(response) || !response.data.idToken) {
    throw new Error("Connexion Google impossible.");
  }
  return response.data.idToken;
}

/** Deconnecte le compte Google local, sinon le SDK reconnecte silencieusement
 * le meme compte au prochain essai sans laisser choisir. Sans module natif
 * disponible, il n'y a rien a deconnecter. */
export async function signOutFromGoogle(): Promise<void> {
  if (!isGoogleSignInAvailable || !googleModule) {
    return;
  }
  await googleModule.GoogleSignin.signOut();
}

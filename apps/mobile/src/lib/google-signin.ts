import {
  GoogleSignin,
  isCancelledResponse,
  isSuccessResponse,
} from "@react-native-google-signin/google-signin";

/** Identifiants OAuth Google (Google Cloud Console). Le client Web est
 * l'audience de l'id_token emis par le SDK natif : c'est lui que le backend
 * verifie, et c'est le meme client que celui utilise par le web. */
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";

/** Le bouton Google n'est affiche que si la config est presente — sans ca,
 * `signIn()` echouerait avec une erreur native peu parlante. */
export const isGoogleSignInConfigured = Boolean(WEB_CLIENT_ID);

if (isGoogleSignInConfigured) {
  GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID,
    iosClientId: IOS_CLIENT_ID || undefined,
  });
}

export const googleWebClientId = WEB_CLIENT_ID;

/** Ouvre le flux natif Google (feuille Safari/Play Services, puis retour dans
 * l'app). Retourne `null` si l'utilisateur annule — un abandon n'est pas une
 * erreur a afficher. */
export async function signInWithGoogle(): Promise<string | null> {
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
 * le meme compte au prochain essai sans laisser choisir. */
export function signOutFromGoogle() {
  return isGoogleSignInConfigured ? GoogleSignin.signOut() : Promise.resolve(null);
}

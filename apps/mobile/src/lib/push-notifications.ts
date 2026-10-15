import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api } from "./api";

/** Notification recue app ouverte : on l'affiche quand meme. Sans ce handler, iOS
 * l'avale silencieusement au premier plan. Declare au chargement du module, comme
 * l'exige expo-notifications (avant tout affichage). */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/** Depuis le SDK 53, Expo Go ne recoit plus de push distantes sur Android (et le
 * jeton demande echouerait). On sort proprement plutot que de faire remonter une
 * erreur a chaque demarrage : un build de dev (`expo-dev-client`) les recoit. */
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
export const isPushSupported = !(isExpoGo && Platform.OS === "android");

const ANDROID_CHANNEL_ID = "default";

/** Android n'affiche rien sans canal : il porte l'importance, le son et la
 * vibration de la notification. */
async function ensureAndroidChannel() {
  if (Platform.OS !== "android") {
    return;
  }
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: "Notifications",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
  });
}

/** Demande la permission puis renvoie le jeton Expo de cet appareil. `null` quand
 * l'utilisateur refuse (ou que la plateforme ne peut pas en fournir) — un refus
 * n'est pas une erreur, l'app fonctionne sans push. */
export async function getExpoPushToken(): Promise<string | null> {
  if (!isPushSupported) {
    return null;
  }

  await ensureAndroidChannel();

  const existing = await Notifications.getPermissionsAsync();
  const granted =
    existing.granted || (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) {
    return null;
  }

  // `projectId` vient de `extra.eas.projectId` (app.json) : c'est lui qui relie le
  // jeton au projet Expo qui enverra les notifications.
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) {
    return null;
  }

  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  return data;
}

/** Jeton enregistre pour la session en cours : retenu ici pour pouvoir le retirer a
 * la deconnexion sans le redemander au systeme. */
let registeredToken: string | null = null;

export async function registerDeviceForPush(): Promise<string | null> {
  const token = await getExpoPushToken();
  if (!token) {
    return null;
  }
  await api.notifications.registerDevice({
    token,
    platform: Platform.OS === "ios" ? "ios" : "android",
  });
  registeredToken = token;
  return token;
}

/** A appeler avant de fermer la session : l'appel a besoin d'un jeton de session
 * encore valide. Silencieux en cas d'echec — ne pas empecher une deconnexion. */
export async function unregisterCurrentDevice() {
  if (!registeredToken) {
    return;
  }
  try {
    await api.notifications.unregisterDevice(registeredToken);
  } catch {
    // Le serveur purgera de toute facon le jeton au premier envoi refuse.
  } finally {
    registeredToken = null;
  }
}

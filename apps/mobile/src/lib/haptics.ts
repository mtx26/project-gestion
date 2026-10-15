import * as Haptics from "expo-haptics";

/** Retours haptiques de l'app. Volontairement parcimonieux : un appui long qui
 * ouvre un menu, et les fins d'action importantes. Chaque appel avale ses erreurs —
 * un simulateur ou un appareil sans moteur haptique ne doit pas faire echouer
 * l'action qui l'accompagne. */

export function longPressFeedback() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

export function successFeedback() {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function warningFeedback() {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}

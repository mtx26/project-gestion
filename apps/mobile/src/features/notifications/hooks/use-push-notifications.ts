import { queryKeys } from "@project-gestion/query-keys";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { isPushSupported, registerDeviceForPush } from "../../../lib/push-notifications";

/** Branche l'appareil sur les notifications push, une fois connecte : enregistrement
 * du jeton, rafraichissement de la liste quand une notification arrive app ouverte,
 * et ouverture de l'ecran Notifications quand l'utilisateur en tape une.
 *
 * A monter une seule fois, dans le layout du groupe authentifie : c'est ce qui
 * garantit qu'on ne demande jamais la permission a quelqu'un de deconnecte. */
export function usePushNotifications() {
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isPushSupported) {
      return;
    }
    // Un refus de permission renvoie `null` : ce n'est pas une erreur a remonter,
    // l'app marche sans push.
    void registerDeviceForPush().catch(() => {});
  }, []);

  useEffect(() => {
    // App ouverte : la notification s'affiche (voir `setNotificationHandler`), mais
    // c'est a nous de rafraichir la liste et le compteur de la cloche.
    const receivedSubscription = Notifications.addNotificationReceivedListener(() => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener(() => {
      // Les seules notifications envoyees aujourd'hui (invitation, invitation
      // acceptee) se traitent depuis l'ecran Notifications.
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
      router.push("/notifications");
    });

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, [queryClient, router]);
}

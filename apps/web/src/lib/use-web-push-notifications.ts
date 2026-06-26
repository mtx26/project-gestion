"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getToken, onMessage } from "firebase/messaging";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@project-gestion/query-keys";
import { api } from "@/lib/api";
import { getFirebaseMessaging, isFirebaseConfigured } from "@/lib/firebase";

type PushPermission = "default" | "granted" | "denied" | "unsupported";

export function useWebPushNotifications() {
  const queryClient = useQueryClient();
  const [permission, setPermission] = useState<PushPermission>("default");
  const [isRegistering, setIsRegistering] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const isSupported =
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    isFirebaseConfigured();

  useEffect(() => {
    if (!isSupported) return;
    setPermission(Notification.permission as PushPermission);
  }, [isSupported]);

  useEffect(() => {
    if (!isSupported || Notification.permission !== "granted") return;

    const messaging = getFirebaseMessaging();
    if (!messaging) return;

    // Handle foreground messages: refresh the unread count badge
    unsubscribeRef.current = onMessage(messaging, () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    });

    return () => {
      unsubscribeRef.current?.();
    };
  }, [isSupported, queryClient]);

  const requestPermission = useCallback(async () => {
    if (!isSupported || isRegistering) return;

    setIsRegistering(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result as PushPermission);

      if (result !== "granted") return;

      const swRegistration = await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js",
        { scope: "/" },
      );

      const messaging = getFirebaseMessaging();
      if (!messaging) return;

      const token = await getToken(messaging, {
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: swRegistration,
      });

      if (token) {
        await api.devices.register({ fcm_token: token, platform: "web" });
      }
    } catch {
      // Silently fail — push is an enhancement, not a requirement
    } finally {
      setIsRegistering(false);
    }
  }, [isSupported, isRegistering]);

  return { isSupported, permission, isRegistering, requestPermission };
}

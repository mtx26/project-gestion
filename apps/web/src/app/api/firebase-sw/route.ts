import { NextResponse } from "next/server";

/**
 * Serves firebase-messaging-sw.js dynamically so NEXT_PUBLIC_FIREBASE_CONFIG
 * is injected at request time. Rewired via next.config.ts to respond at
 * /firebase-messaging-sw.js with Service-Worker-Allowed: / so the SW controls
 * the entire origin.
 */
export async function GET() {
  const raw = process.env.NEXT_PUBLIC_FIREBASE_CONFIG ?? "{}";

  const sw = `
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp(${raw});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  const title = payload.notification?.title ?? "Nouvelle notification";
  const body = payload.notification?.body ?? "";
  self.registration.showNotification(title, {
    body,
    icon: "/favicon.ico",
  });
});
`;

  return new NextResponse(sw, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Service-Worker-Allowed": "/",
      "Cache-Control": "no-store",
    },
  });
}

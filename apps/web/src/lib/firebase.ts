"use client";

import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getMessaging, type Messaging } from "firebase/messaging";

function getFirebaseConfig(): Record<string, string> | null {
  const raw = process.env.NEXT_PUBLIC_FIREBASE_CONFIG;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return null;
  }
}

export function isFirebaseConfigured(): boolean {
  return getFirebaseConfig() !== null;
}

function getFirebaseApp(): FirebaseApp {
  if (getApps().length) return getApps()[0]!;
  return initializeApp(getFirebaseConfig()!);
}

export function getFirebaseMessaging(): Messaging | null {
  if (typeof window === "undefined") return null;
  if (!isFirebaseConfigured()) return null;
  return getMessaging(getFirebaseApp());
}

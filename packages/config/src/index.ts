export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  "http://127.0.0.1:8000";

export const tokenStorageKeys = {
  access: "project-gestion.access",
  refresh: "project-gestion.refresh",
} as const;

export const theme = {
  colors: {
    background: "#f8fafc",
    surface: "#ffffff",
    foreground: "#111827",
    muted: "#6b7280",
    border: "#e5e7eb",
    primary: "#0f766e",
    primaryForeground: "#ffffff",
    danger: "#dc2626",
  },
  radius: {
    sm: 6,
    md: 8,
    lg: 10,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },
} as const;


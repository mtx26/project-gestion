export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  "http://127.0.0.1:8000";

export const tokenStorageKeys = {
  access: "project-gestion.access",
  refresh: "project-gestion.refresh",
} as const;

/** Mirrors the backend's default document-upload limits (`DOCUMENT_MAX_UPLOAD_SIZE_BYTES` /
 * `DOCUMENT_ALLOWED_FILE_EXTENSIONS` / `DOCUMENT_ALLOWED_MIME_TYPES` in `config/settings.py`),
 * so a file Zod-side validation accepts can't be rejected by the backend on size or type.
 * These are the *default* values — if an environment overrides the backend env vars, this
 * constant needs to be updated to match (there is no endpoint that exposes the live limits). */
export const documentUploadLimits = {
  maxSizeBytes: 100 * 1024 * 1024,
  allowedExtensions: new Set([
    ".pdf", ".jpg", ".jpeg", ".png", ".webp", ".gif", ".tif", ".tiff",
    ".bmp", ".svg", ".heic", ".heif", ".dwg", ".dxf", ".ifc", ".rvt",
    ".skp", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt",
    ".csv",
  ]),
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


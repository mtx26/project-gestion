export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  "http://127.0.0.1:8000";

/** Mirrors the backend's default document-upload limits (`DOCUMENT_MAX_UPLOAD_SIZE_BYTES` /
 * `DOCUMENT_ALLOWED_FILE_EXTENSIONS` / `DOCUMENT_ALLOWED_MIME_TYPES` in `config/settings.py`),
 * so a file Zod-side validation accepts can't be rejected by the backend on size or type.
 * These are the *default* values — if an environment overrides the backend env vars, this
 * constant needs to be updated to match (there is no endpoint that exposes the live limits). */
/** Schema d'URL de l'application mobile (`expo.scheme` dans apps/mobile/app.json).
 * Le web s'en sert pour proposer d'ouvrir un lien dans l'app quand elle est
 * installee. */
export const MOBILE_APP_SCHEME = "projectgestion";

export const documentUploadLimits = {
  maxSizeBytes: 100 * 1024 * 1024,
  allowedExtensions: new Set([
    ".pdf", ".jpg", ".jpeg", ".png", ".webp", ".gif", ".tif", ".tiff",
    ".bmp", ".svg", ".heic", ".heif", ".dwg", ".dxf", ".ifc", ".rvt",
    ".skp", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt",
    ".csv",
  ]),
} as const;

/** Les deux palettes de l'application, alignees sur les variables CSS du web
 * (`:root` et `.dark` dans `apps/web/src/app/globals.css`).
 *
 * Une divergence assumee : en sombre, le web laisse `--primary` sur le gris neutre
 * par defaut de shadcn et perd donc son accentuation. Ici le vert est conserve,
 * eclairci en teal-400 — le teal-700 du mode clair n'a pas assez de contraste sur
 * un fond quasi noir. */
export const themeColors = {
  light: {
    background: "#f8fafc",
    surface: "#ffffff",
    foreground: "#111827",
    muted: "#6b7280",
    border: "#e5e7eb",
    primary: "#0f766e",
    primaryForeground: "#ffffff",
    danger: "#dc2626",
    dangerForeground: "#ffffff",
  },
  dark: {
    background: "#0a0a0a",
    surface: "#171717",
    foreground: "#fafafa",
    muted: "#a1a1a1",
    border: "#262626",
    primary: "#2dd4bf",
    primaryForeground: "#0a0a0a",
    danger: "#ef4444",
    dangerForeground: "#ffffff",
  },
} as const;

export const theme = {
  /** Palette claire. Sur mobile, preferer `theme.colors` de `apps/mobile/src/theme`,
   * qui suit l'apparence du systeme. */
  colors: themeColors.light,
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


import { API_BASE_URL } from "@project-gestion/config";
import { getCsrfToken } from "@/lib/api";

/** Client dedie aux endpoints allauth Headless (`_allauth/browser/v1/*`).
 * Enveloppe de reponse `{status, data, meta, errors}` et semantique (un 401
 * "pas connecte" est un etat normal, pas une erreur) totalement differents du
 * client JWT de `packages/api` -> volontairement separe, pas de fetch partage. */

const HEADLESS_BASE = "_allauth/browser/v1";

export type HeadlessFlow = { id: string; is_pending?: boolean };

export type HeadlessFieldError = { message: string; code: string; param?: string };

export type HeadlessResponse = {
  status: number;
  // Le seul champ de `data` jamais lu cote web est `flows` (etat "en attente
  // de verification email") — le profil complet vient toujours de
  // `api.auth.me()` ensuite, pas de la reponse headless elle-meme.
  data?: { flows?: HeadlessFlow[] };
  meta?: { is_authenticated?: boolean };
  errors?: HeadlessFieldError[];
};

const ERROR_MESSAGES: Record<string, string> = {
  email_password_mismatch: "Email ou mot de passe incorrect.",
  username_password_mismatch: "Nom d'utilisateur ou mot de passe incorrect.",
  too_many_login_attempts: "Trop de tentatives. Reessaie plus tard.",
  invalid_login: "Identifiants invalides.",
  email_taken: "Un compte existe deja avec cet email.",
  username_taken: "Ce nom d'utilisateur est deja utilise.",
};

export class HeadlessError extends Error {
  response: HeadlessResponse;

  constructor(response: HeadlessResponse) {
    const firstError = response.errors?.[0];
    super(firstError ? (ERROR_MESSAGES[firstError.code] ?? firstError.message) : "Une erreur est survenue.");
    this.name = "HeadlessError";
    this.response = response;
  }
}

export function isEmailVerificationPending(error: unknown): boolean {
  if (!(error instanceof HeadlessError)) {
    return false;
  }
  return (error.response.data?.flows ?? []).some(
    (flow) => flow.id === "verify_email" && flow.is_pending,
  );
}

/** Tout endpoint "browser" d'allauth Headless pose un cookie CSRF frais a
 * chaque reponse (cf. `browser_view`/`get_token()` cote Django) — mais si
 * aucun appel headless n'a encore eu lieu (ex. l'utilisateur clique "Continuer
 * avec Google" avant que le `restoreSession()` de demarrage n'ait resolu), le
 * cookie peut ne pas encore exister. On le garantit ici avant tout POST/DELETE
 * plutot que de dependre du timing du bootstrap. */
async function ensureCsrfToken(): Promise<string | null> {
  const existing = getCsrfToken();
  if (existing) {
    return existing;
  }
  await headlessFetch("auth/session");
  return getCsrfToken();
}

async function headlessFetch(path: string, options: RequestInit = {}): Promise<HeadlessResponse> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body != null) {
    headers.set("Content-Type", "application/json");
  }

  const method = (options.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers.set("X-CSRFToken", csrfToken);
    }
  }

  const response = await fetch(`${API_BASE_URL}/${HEADLESS_BASE}/${path.replace(/^\//, "")}`, {
    ...options,
    credentials: "include",
    headers,
  });

  return (await response.json()) as HeadlessResponse;
}

/** Verifie la session courante ET pose le cookie CSRF (tout endpoint "browser"
 * d'allauth Headless en emet un frais a chaque appel) — a appeler avant tout
 * POST/DELETE headless, et au demarrage de l'app pour le bootstrap d'auth. */
export function getSession() {
  return headlessFetch("auth/session");
}

/** 401 est un etat normal ici (ex. "en attente de verification email") ;
 * seul un vrai statut d'erreur (400+, hors 401) doit lever. */
function throwIfInputError(response: HeadlessResponse) {
  if (response.status >= 400 && response.status !== 401) {
    throw new HeadlessError(response);
  }
}

export async function signup(payload: { email: string; password: string }): Promise<HeadlessResponse> {
  await ensureCsrfToken();
  const response = await headlessFetch("auth/signup", { method: "POST", body: JSON.stringify(payload) });
  throwIfInputError(response);
  return response;
}

export async function login(
  credentials: { email: string; password: string } | { username: string; password: string },
): Promise<HeadlessResponse> {
  await ensureCsrfToken();
  const response = await headlessFetch("auth/login", { method: "POST", body: JSON.stringify(credentials) });
  throwIfInputError(response);
  if (!response.meta?.is_authenticated) {
    throw new HeadlessError(response);
  }
  return response;
}

export async function logout() {
  await ensureCsrfToken();
  return headlessFetch("auth/session", { method: "DELETE" });
}

/** Flux "provider redirect" : navigation pleine page vers Google via un vrai
 * POST HTML (pas un fetch) — allauth redirige ensuite le navigateur. */
export async function redirectToGoogle(callbackUrl: string) {
  const csrfToken = await ensureCsrfToken();

  const form = document.createElement("form");
  form.method = "POST";
  form.action = `${API_BASE_URL}/${HEADLESS_BASE}/auth/provider/redirect`;

  const fields: Record<string, string> = {
    provider: "google",
    process: "login",
    callback_url: callbackUrl,
    csrfmiddlewaretoken: csrfToken ?? "",
  };

  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();
}

import { API_BASE_URL } from "@project-gestion/config";
import * as SecureStore from "expo-secure-store";

/** Client dedie aux endpoints allauth Headless (`_allauth/app/v1/*`), le
 * client "app" (token de session dans l'en-tete X-Session-Token, pas de
 * cookie ni de CSRF — cf. web/src/lib/allauth-client.ts pour l'equivalent
 * "browser"). Enveloppe de reponse `{status, data, meta, errors}` totalement
 * differente de l'ancien client JWT -> volontairement separe. */

const HEADLESS_BASE = "_allauth/app/v1";
const SESSION_TOKEN_KEY = "project-gestion.session-token";

export type HeadlessFlow = { id: string; is_pending?: boolean };

export type HeadlessFieldError = { message: string; code: string; param?: string };

export type HeadlessResponse = {
  status: number;
  // Le seul champ de `data` jamais lu ici est `flows` (etat "en attente de
  // verification email") — le profil complet vient toujours de `api.auth.me()`.
  data?: { flows?: HeadlessFlow[] };
  meta?: { is_authenticated?: boolean; session_token?: string };
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

export function getSessionToken(): Promise<string | null> {
  return SecureStore.getItemAsync(SESSION_TOKEN_KEY);
}

/** allauth n'emet un `session_token` dans `meta` que sur les appels qui
 * modifient effectivement la session (login/logout) — un simple GET de
 * verification n'en renvoie pas, ce qui est deja le comportement voulu ici. */
async function persistSessionToken(response: HeadlessResponse) {
  if (response.meta?.session_token) {
    await SecureStore.setItemAsync(SESSION_TOKEN_KEY, response.meta.session_token);
  }
}

async function headlessFetch(path: string, options: RequestInit = {}): Promise<HeadlessResponse> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body != null) {
    headers.set("Content-Type", "application/json");
  }

  const token = await getSessionToken();
  if (token) {
    headers.set("X-Session-Token", token);
  }

  const response = await fetch(`${API_BASE_URL}/${HEADLESS_BASE}/${path.replace(/^\//, "")}`, {
    ...options,
    headers,
  });

  const data = (await response.json()) as HeadlessResponse;
  await persistSessionToken(data);
  return data;
}

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
  const response = await headlessFetch("auth/signup", { method: "POST", body: JSON.stringify(payload) });
  throwIfInputError(response);
  return response;
}

export async function login(
  credentials: { email: string; password: string } | { username: string; password: string },
): Promise<HeadlessResponse> {
  const response = await headlessFetch("auth/login", { method: "POST", body: JSON.stringify(credentials) });
  throwIfInputError(response);
  if (!response.meta?.is_authenticated) {
    throw new HeadlessError(response);
  }
  return response;
}

/** Connexion Google : l'app obtient elle-meme l'id_token aupres de Google
 * (SDK natif), le backend le verifie. C'est le flux prevu par allauth pour
 * un client "app" — `auth/provider/redirect` est reserve au navigateur.
 *
 * `client_id` doit etre celui du client **Web** Google : c'est l'audience de
 * l'id_token emis par le SDK natif (configure via `webClientId`), et c'est ce
 * qui permet a allauth de retrouver l'app correspondante cote serveur. */
export async function loginWithGoogle(idToken: string, clientId: string): Promise<HeadlessResponse> {
  const response = await headlessFetch("auth/provider/token", {
    method: "POST",
    body: JSON.stringify({
      provider: "google",
      process: "login",
      token: { client_id: clientId, id_token: idToken },
    }),
  });
  throwIfInputError(response);
  if (!response.meta?.is_authenticated) {
    throw new HeadlessError(response);
  }
  return response;
}

export async function logout() {
  try {
    return await headlessFetch("auth/session", { method: "DELETE" });
  } finally {
    await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
  }
}

import { API_BASE_URL } from "@project-gestion/config";

const CSRF_COOKIE_NAME = "csrftoken";

/** Lit le cookie CSRF pose par Django. Il n'est volontairement pas HttpOnly :
 * c'est la seule valeur que le frontend doit relire pour renvoyer l'en-tete
 * `X-CSRFToken` sur les requetes non idempotentes. */
export function readCsrfToken(): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${CSRF_COOKIE_NAME}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

/** Force Django a poser le cookie CSRF si le navigateur ne l'a pas encore.
 * Toute reponse d'un endpoint headless "browser" l'inclut. */
export async function ensureCsrfToken(): Promise<string | null> {
  if (readCsrfToken()) {
    return readCsrfToken();
  }

  await fetch(`${API_BASE_URL.replace(/\/$/, "")}/_allauth/browser/v1/auth/session`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  return readCsrfToken();
}

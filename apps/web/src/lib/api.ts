import { createApiClient } from "@project-gestion/api";
import { API_BASE_URL } from "@project-gestion/config";

const isBrowser = () => typeof window !== "undefined";

/** Reads Django's `csrftoken` cookie (set on any allauth Headless browser-view
 * response) so mutating requests can carry it back as `X-CSRFToken`. */
export function getCsrfToken(): string | null {
  if (!isBrowser()) {
    return null;
  }

  const match = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export const api = createApiClient({
  baseUrl: API_BASE_URL,
  credentials: "include",
  getCsrfToken,
  onSessionInvalid: () => {
    if (isBrowser() && !window.location.pathname.startsWith("/auth")) {
      window.location.assign("/auth/login");
    }
  },
});

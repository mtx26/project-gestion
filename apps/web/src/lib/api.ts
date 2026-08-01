import { createApiClient } from "@project-gestion/api";
import { API_BASE_URL } from "@project-gestion/config";
import { readCsrfToken } from "@/lib/csrf";

const isBrowser = () => typeof window !== "undefined";

export const api = createApiClient({
  baseUrl: API_BASE_URL,
  // Client headless "browser" : la session vit dans un cookie HttpOnly pose par
  // Django, rien n'est conserve cote JavaScript.
  client: "browser",
  getCsrfToken: readCsrfToken,
  onSessionInvalid: () => {
    if (isBrowser() && !window.location.pathname.startsWith("/auth")) {
      window.location.assign("/auth/login");
    }
  },
});

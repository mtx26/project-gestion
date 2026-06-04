export const DEFAULT_AUTH_REDIRECT_PATH = "/secure";
export const AUTH_REDIRECT_PATH = "/auth/redirect";
export const LOGIN_PATH = "/login";
export const REGISTER_PATH = "/register";

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL;
}

export function getSafeNext(value: string | null | undefined) {
  if (!value || value.startsWith("//") || value.includes("\\")) {
    return DEFAULT_AUTH_REDIRECT_PATH;
  }

  try {
    const appUrl = getAppUrl();

    if (!appUrl || !value.startsWith("/")) {
      return DEFAULT_AUTH_REDIRECT_PATH;
    }

    const baseUrl = new URL(appUrl);
    const url = new URL(value, baseUrl);

    if (url.origin !== baseUrl.origin) {
      return DEFAULT_AUTH_REDIRECT_PATH;
    }

    if (
      url.pathname === LOGIN_PATH ||
      url.pathname === REGISTER_PATH ||
      url.pathname === AUTH_REDIRECT_PATH
    ) {
      return DEFAULT_AUTH_REDIRECT_PATH;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return DEFAULT_AUTH_REDIRECT_PATH;
  }
}

export function getNextFromSearch(searchParams: URLSearchParams) {
  return getSafeNext(searchParams.get("next"));
}

export function withAuthRedirectNext(nextPath?: string | null) {
  return `${AUTH_REDIRECT_PATH}?next=${encodeURIComponent(getSafeNext(nextPath))}`;
}

export function withLoginNext(nextPath?: string | null) {
  return `${LOGIN_PATH}?next=${encodeURIComponent(getSafeNext(nextPath))}`;
}

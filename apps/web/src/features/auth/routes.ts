export const DEFAULT_AUTH_REDIRECT_PATH = "/secure";
export const AUTH_CALLBACK_PATH = "/auth/callback";
export const AUTH_REDIRECT_PATH = "/auth/redirect";
export const LOGIN_PATH = "/login";
export const REGISTER_PATH = "/register";

export function getSafeNext(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return DEFAULT_AUTH_REDIRECT_PATH;
  }

  const pathname = value.split(/[?#]/, 1)[0];

  if (
    pathname === LOGIN_PATH ||
    pathname === REGISTER_PATH ||
    pathname === AUTH_CALLBACK_PATH ||
    pathname === AUTH_REDIRECT_PATH
  ) {
    return DEFAULT_AUTH_REDIRECT_PATH;
  }

  return value;
}

export function getNextFromSearch(searchParams: URLSearchParams) {
  return getSafeNext(searchParams.get("next"));
}

export function withAuthRedirectNext(nextPath?: string | null) {
  return `${AUTH_REDIRECT_PATH}?next=${encodeURIComponent(getSafeNext(nextPath))}`;
}

export function withAuthCallbackNext(nextPath?: string | null) {
  return `${AUTH_CALLBACK_PATH}?next=${encodeURIComponent(getSafeNext(nextPath))}`;
}

export function withLoginNext(nextPath?: string | null) {
  return `${LOGIN_PATH}?next=${encodeURIComponent(getSafeNext(nextPath))}`;
}

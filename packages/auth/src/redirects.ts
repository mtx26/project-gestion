import type { AuthMode } from "./types";

export type AuthFlow = AuthMode | "sign-out";

export type AuthRedirects =
  | string
  | Partial<Record<AuthFlow, string>>
  | ((flow: AuthFlow) => string | undefined);

export function resolveAuthRedirect(
  redirects: AuthRedirects | undefined,
  flow: AuthFlow
) {
  if (!redirects) {
    return undefined;
  }

  if (typeof redirects === "string") {
    return redirects;
  }

  if (typeof redirects === "function") {
    return redirects(flow);
  }

  return redirects[flow];
}

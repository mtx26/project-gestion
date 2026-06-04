export function getRegisterRedirect() {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.location.origin + "/login";
}

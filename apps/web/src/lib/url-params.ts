export function buildClearParams(
  searchParams: { toString(): string },
  removeKeys: string[],
): URLSearchParams {
  const params = new URLSearchParams(searchParams.toString());
  for (const key of removeKeys) {
    params.delete(key);
  }
  return params;
}

export function parseIdParam(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function parseBooleanParam(value: string | null): boolean {
  return value === "1" || value === "true";
}

export function setOptionalParam(params: URLSearchParams, key: string, value: string | "all") {
  if (value && value !== "all") params.set(key, value);
  else params.delete(key);
}

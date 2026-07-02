export function buildProjectHref(
  path: string,
  projectId: number | string,
  searchParams?: { toString(): string },
): string {
  const params = new URLSearchParams(searchParams?.toString() ?? "");
  params.set("project", String(projectId));
  params.delete("page");
  return `${path}?${params.toString()}`;
}

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

export function parsePageParam(value: string | null): number {
  if (!value) return 1;
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export function parseBooleanParam(value: string | null): boolean {
  return value === "1" || value === "true";
}

export function parseEnumParam<T extends string>(
  value: string | null,
  valid: readonly T[],
  fallback: T,
): T {
  if (value !== null && (valid as readonly string[]).includes(value)) return value as T;
  return fallback;
}

/**
 * Build a new URLSearchParams from existing params, always preserving unknown keys.
 * Rules per value:
 *   undefined  → skip (don't touch the param)
 *   null | false | "all" → delete the param
 *   true       → set to "1"
 *   other      → set to String(value)
 */
export function buildFilterParams(
  searchParams: { toString(): string },
  projectId: number | null,
  changes: Record<string, string | number | boolean | null | undefined>,
): URLSearchParams {
  const params = new URLSearchParams(searchParams.toString());
  if (projectId != null) params.set("project", String(projectId));
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined) continue;
    if (value === null || value === false || value === "all") {
      params.delete(key);
    } else if (value === true) {
      params.set(key, "1");
    } else {
      params.set(key, String(value));
    }
  }
  return params;
}

/**
 * Lecture et ecriture des filtres portes par l'URL.
 *
 * Ecriture : un patch decrit les cles a changer, les autres sont preservees.
 *   undefined → ne pas toucher au parametre
 *   null | false → le supprimer
 *   true → "1" (relu par `parseBooleanParam`)
 *   autre → String(value)
 *
 * Aucune valeur n'est traitee comme un sentinel : pour qu'une option sorte de
 * l'URL parce qu'elle vaut le defaut de la page, passer par `omitDefault`.
 */
export type ParamPatch = Record<string, string | number | boolean | null | undefined>;

function patchParams(params: URLSearchParams, patch: ParamPatch): URLSearchParams {
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (value === null || value === false) {
      params.delete(key);
    } else {
      params.set(key, value === true ? "1" : String(value));
    }
  }
  return params;
}

/** Un filtre qui vaut le defaut de la page n'a rien a faire dans l'URL : il en sort
 * au lieu d'y etre ecrit. A utiliser pour toute option de `FilterSelect`, y compris
 * `"all"` — qui n'est le defaut que sur certaines pages (temps : `not_paid`,
 * taches : `not_done`), donc jamais un "pas de filtre" universel. */
export function omitDefault<T extends string>(value: T, pageDefault: string): T | null {
  return value === pageDefault ? null : value;
}

/** Applique `changes` aux parametres courants, en forcant le projet actif. */
export function buildFilterParams(
  searchParams: { toString(): string },
  projectId: number | null,
  changes: ParamPatch,
): URLSearchParams {
  const params = new URLSearchParams(searchParams.toString());
  if (projectId != null) params.set("project", String(projectId));
  return patchParams(params, changes);
}

/** Parametres courants moins `removeKeys` — les cles inconnues sont preservees. */
export function buildClearParams(
  searchParams: { toString(): string },
  removeKeys: string[],
): URLSearchParams {
  return patchParams(
    new URLSearchParams(searchParams.toString()),
    Object.fromEntries(removeKeys.map((key) => [key, null])),
  );
}

/** Lien vers une page du projet : change de projet remet la pagination a zero. */
export function buildProjectHref(
  path: string,
  projectId: number | string,
  searchParams?: { toString(): string },
): string {
  const params = patchParams(new URLSearchParams(searchParams?.toString() ?? ""), {
    project: projectId,
    page: null,
  });
  return `${path}?${params.toString()}`;
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

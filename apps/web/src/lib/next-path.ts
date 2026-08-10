const LOGIN_PATH = "/auth/login";

/** Chemin de retour apres connexion, transporte dans `?next=`.
 *
 * N'accepte qu'un chemin interne : un `next` venant de l'URL est une entree
 * utilisateur, donc une URL absolue (`https://evil.tld`) ou protocol-relative
 * (`//evil.tld`) ouvrirait une redirection vers un site tiers apres login. */
export function getSafeNextPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }
  // Repartir sur /auth/* apres connexion n'a pas de sens (boucle).
  return value.startsWith("/auth/") ? null : value;
}

/** URL de connexion qui memorise la page demandee, pour y revenir apres login. */
export function buildLoginUrl(nextPath: string | null | undefined): string {
  const safeNext = getSafeNextPath(nextPath);
  return safeNext ? `${LOGIN_PATH}?next=${encodeURIComponent(safeNext)}` : LOGIN_PATH;
}

/** Ajoute `?next=` a une URL interne, en preservant ses parametres existants. */
export function withNextParam(path: string, nextPath: string | null | undefined): string {
  const safeNext = getSafeNextPath(nextPath);
  if (!safeNext) {
    return path;
  }
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}next=${encodeURIComponent(safeNext)}`;
}

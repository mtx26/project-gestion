"use client";

import type { ReadonlyURLSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { buildFilterParams, type ParamPatch } from "@/lib/url-params";

/** Ecrit un changement de filtre dans l'URL de `path` (voir `ParamPatch` pour la
 * signification des valeurs). Changer un filtre renvoie a la page 1, sauf quand
 * c'est justement la pagination qui change. */
export function useUrlFilter(
  path: string,
  searchParams: ReadonlyURLSearchParams,
  projectId: number | null,
) {
  const router = useRouter();
  return function updateUrlFilter(changes: ParamPatch) {
    const params = buildFilterParams(searchParams, projectId, changes);
    if (!("page" in changes)) {
      params.delete("page");
    }
    router.replace(`${path}?${params.toString()}`, { scroll: false });
  };
}

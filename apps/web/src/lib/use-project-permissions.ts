"use client";

import { useMemo } from "react";
import { hasProjectPermission, type PermissionCode, type ProjectPermissionState } from "@project-gestion/permissions";

/** Centralizes `hasProjectPermission(project, userId, code)` calls so pages don't
 * repeat the same (project, userId) pair for every permission code they check. */
export function useProjectPermissions(
  project: ProjectPermissionState | null | undefined,
  userId: number | null | undefined,
) {
  return useMemo(
    () => ({
      can: (code: PermissionCode) => hasProjectPermission(project, userId, code),
    }),
    [project, userId],
  );
}

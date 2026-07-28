import { useMemo } from "react";
import {
  hasProjectPermission,
  type PermissionCode,
  type ProjectPermissionState,
} from "@project-gestion/permissions";

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

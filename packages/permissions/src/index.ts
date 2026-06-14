export const permissionCodes = {
  projectEdit: "project.edit",
  projectRestore: "project.restore",
  roleView: "role.view",
  roleEdit: "role.edit",
  roleDelete: "role.delete",
  roleRestore: "role.restore",
  memberView: "member.view",
  memberEdit: "member.edit",
  fileView: "file.view",
  fileEdit: "file.edit",
  fileDelete: "file.delete",
  fileRestore: "file.restore",
  taskView: "task.view",
  taskEdit: "task.edit",
  taskDelete: "task.delete",
  taskRestore: "task.restore",
  timeEntryView: "time_entry.view",
  timeEntryEdit: "time_entry.edit",
  timeEntryDelete: "time_entry.delete",
  timeEntryRestore: "time_entry.restore",
  financeView: "finance.view",
  financeEdit: "finance.edit",
  financeDelete: "finance.delete",
  financeRestore: "finance.restore",
} as const;

export type PermissionCode = (typeof permissionCodes)[keyof typeof permissionCodes];

export const allProjectPermissionCodes = Object.values(permissionCodes);

export const permissionScopeLabels = {
  project: "Projet",
  role: "Roles",
  member: "Membres",
  file: "Fichiers",
  task: "Taches",
  time_entry: "Temps",
  finance: "Finance",
  other: "Autres",
} as const;

export type PermissionScope = keyof typeof permissionScopeLabels;

export type ProjectPermissionState = {
  owner: number;
  current_user_permission_codes?: string[];
};

export type PermissionLike = {
  code: string;
};

export function isProjectOwner(
  project: ProjectPermissionState | null | undefined,
  userId: number | null | undefined,
) {
  return Boolean(project && userId != null && project.owner === userId);
}

export function hasProjectPermission(
  project: ProjectPermissionState | null | undefined,
  userId: number | null | undefined,
  permissionCode: PermissionCode,
) {
  if (!project) {
    return false;
  }

  if (isProjectOwner(project, userId)) {
    return true;
  }

  return project.current_user_permission_codes?.includes(permissionCode) ?? false;
}

export function canEditProject(
  project: ProjectPermissionState | null | undefined,
  userId: number | null | undefined,
) {
  return hasProjectPermission(project, userId, permissionCodes.projectEdit);
}

export function canDeleteProject(
  project: ProjectPermissionState | null | undefined,
  userId: number | null | undefined,
) {
  return isProjectOwner(project, userId);
}

export function getPermissionScope(code: string): PermissionScope {
  const scope = code.split(".")[0] || "other";

  return scope in permissionScopeLabels ? (scope as PermissionScope) : "other";
}

export function getPermissionAction(code: string) {
  const [, ...actionParts] = code.split(".");

  return actionParts.join(".") || code;
}

export function formatPermissionScope(scope: string) {
  return permissionScopeLabels[scope as PermissionScope] ?? permissionScopeLabels.other;
}

export function groupPermissionsByScope<TPermission extends PermissionLike>(permissions: TPermission[]) {
  const groups = new Map<PermissionScope, TPermission[]>();

  for (const permission of permissions) {
    const scope = getPermissionScope(permission.code);
    groups.set(scope, [...(groups.get(scope) ?? []), permission]);
  }

  return Array.from(groups.entries()).map(([scope, items]) => ({
    scope,
    label: formatPermissionScope(scope),
    permissions: items,
  }));
}

export function canCreateRoleDraft(name: string, permissionIds: number[]) {
  return name.trim().length > 0 && permissionIds.length > 0;
}

export function buildRolePayload(name: string, permissionIds: number[]) {
  return {
    name: name.trim(),
    permission_ids: permissionIds,
  };
}

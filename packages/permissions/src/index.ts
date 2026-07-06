export const permissionCodes = {
  projectEdit: "project.edit",
  roleView: "role.view",
  roleEdit: "role.edit",
  roleDelete: "role.delete",
  roleRestore: "role.restore",
  memberView: "member.view",
  memberEdit: "member.edit",
  memberEditOwnRate: "member.edit_own_rate",
  memberEditRates: "member.edit_rates",
  fileView: "file.view",
  fileEdit: "file.edit",
  fileDelete: "file.delete",
  fileRestore: "file.restore",
  taskView: "task.view",
  taskEdit: "task.edit",
  taskDelete: "task.delete",
  taskRestore: "task.restore",
  timeEntryView: "time_entry.view",
  timeEntryViewAll: "time_entry.view_all",
  timeEntryEdit: "time_entry.edit",
  timeEntryPay: "time_entry.pay",
  timeEntryDelete: "time_entry.delete",
  timeEntryRestore: "time_entry.restore",
  financeView: "finance.view",
  financeEdit: "finance.edit",
  financeDelete: "finance.delete",
  financeRestore: "finance.restore",
  expenseRequestView: "expense_request.view",
  expenseRequestEdit: "expense_request.edit",
  expenseRequestDelete: "expense_request.delete",
  expenseRequestApprove: "expense_request.approve",
  expenseRequestRestore: "expense_request.restore",
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
  expense_request: "Remboursements",
  other: "Autres",
} as const;

const permissionActionLabels: Record<string, string> = {
  view: "Voir",
  view_all: "Voir toute l'equipe",
  edit: "Creer / modifier",
  edit_own_rate: "Modifier son propre taux horaire",
  edit_rates: "Modifier les taux horaires",
  delete: "Supprimer",
  restore: "Restaurer",
  pay: "Voir equipe et payer",
};

const exactPermissionLabels: Record<string, string> = {
  [permissionCodes.projectEdit]: "Modifier le projet",
};

export const permissionDependencyCodes: Partial<Record<PermissionCode, PermissionCode[]>> = {
  [permissionCodes.roleEdit]: [permissionCodes.roleView],
  [permissionCodes.roleDelete]: [permissionCodes.roleView],
  [permissionCodes.roleRestore]: [permissionCodes.roleView],
  [permissionCodes.memberEdit]: [permissionCodes.memberView],
  [permissionCodes.memberEditRates]: [permissionCodes.memberView],
  [permissionCodes.fileEdit]: [permissionCodes.fileView],
  [permissionCodes.fileDelete]: [permissionCodes.fileView],
  [permissionCodes.fileRestore]: [permissionCodes.fileView],
  [permissionCodes.taskEdit]: [permissionCodes.taskView],
  [permissionCodes.taskDelete]: [permissionCodes.taskView],
  [permissionCodes.taskRestore]: [permissionCodes.taskView],
  [permissionCodes.timeEntryViewAll]: [permissionCodes.timeEntryView],
  [permissionCodes.timeEntryEdit]: [permissionCodes.timeEntryView],
  [permissionCodes.timeEntryDelete]: [permissionCodes.timeEntryView],
  [permissionCodes.timeEntryRestore]: [permissionCodes.timeEntryView],
  [permissionCodes.timeEntryPay]: [
    permissionCodes.timeEntryView,
    permissionCodes.timeEntryViewAll,
  ],
  [permissionCodes.financeEdit]: [permissionCodes.financeView],
  [permissionCodes.financeDelete]: [permissionCodes.financeView],
  [permissionCodes.financeRestore]: [permissionCodes.financeView],
  [permissionCodes.expenseRequestEdit]: [permissionCodes.expenseRequestView],
  [permissionCodes.expenseRequestDelete]: [permissionCodes.expenseRequestView],
  [permissionCodes.expenseRequestApprove]: [permissionCodes.expenseRequestView],
  [permissionCodes.expenseRequestRestore]: [permissionCodes.expenseRequestView],
};

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

export function getPermissionScope(code: string): PermissionScope {
  const scope = code.split(".")[0] || "other";

  return scope in permissionScopeLabels ? (scope as PermissionScope) : "other";
}

export function getPermissionAction(code: string) {
  if (exactPermissionLabels[code]) {
    return exactPermissionLabels[code];
  }

  const [, ...actionParts] = code.split(".");
  const action = actionParts.join(".") || code;

  return permissionActionLabels[action] ?? action;
}

export function formatPermissionCode(code: string) {
  return `${formatPermissionScope(getPermissionScope(code))}: ${getPermissionAction(code)}`;
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

export function normalizePermissionCodes(codes: string[]) {
  const normalizedCodes = new Set(codes);
  let changed = true;

  while (changed) {
    changed = false;

    for (const code of Array.from(normalizedCodes)) {
      const dependencies = permissionDependencyCodes[code as PermissionCode] ?? [];
      for (const dependency of dependencies) {
        if (!normalizedCodes.has(dependency)) {
          normalizedCodes.add(dependency);
          changed = true;
        }
      }
    }
  }

  return Array.from(normalizedCodes);
}

export function normalizePermissionIds<TPermission extends PermissionLike & { id: number }>(
  permissions: TPermission[],
  ids: number[],
) {
  const permissionById = new Map(permissions.map((permission) => [permission.id, permission]));
  const idByCode = new Map(permissions.map((permission) => [permission.code, permission.id]));
  const selectedCodes = ids
    .map((id) => permissionById.get(id)?.code)
    .filter((code): code is string => Boolean(code));

  return normalizePermissionCodes(selectedCodes)
    .map((code) => idByCode.get(code))
    .filter((id): id is number => id != null);
}

export function removePermissionIdWithDependents<TPermission extends PermissionLike & { id: number }>(
  permissions: TPermission[],
  ids: number[],
  removedId: number,
) {
  const permissionById = new Map(permissions.map((permission) => [permission.id, permission]));
  const removedPermission = permissionById.get(removedId);
  if (!removedPermission) {
    return ids.filter((id) => id !== removedId);
  }

  const selectedCodes = new Set(
    ids
      .filter((id) => id !== removedId)
      .map((id) => permissionById.get(id)?.code)
      .filter((code): code is string => Boolean(code)),
  );
  let changed = true;

  while (changed) {
    changed = false;

    for (const code of Array.from(selectedCodes)) {
      const dependencies = permissionDependencyCodes[code as PermissionCode] ?? [];
      if (dependencies.some((dependency) => !selectedCodes.has(dependency))) {
        selectedCodes.delete(code);
        changed = true;
      }
    }
  }

  return permissions
    .filter((permission) => selectedCodes.has(permission.code))
    .map((permission) => permission.id);
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

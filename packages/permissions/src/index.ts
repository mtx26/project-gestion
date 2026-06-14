export const permissionCodes = {
  projectEdit: "project.edit",
  projectDelete: "project.delete",
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

export type ProjectPermissionState = {
  owner: number;
  current_user_permission_codes?: string[];
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

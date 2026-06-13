export const permissionCodes = {
  projectEdit: "project.edit",
  projectDelete: "project.delete",
  projectRestore: "project.restore",
  memberInvite: "member.invite",
  folderView: "folder.view",
  documentCreate: "document.create",
  taskView: "task.view",
  timeEntryView: "time_entry.view",
  financeView: "finance.view",
} as const;

export type PermissionCode = (typeof permissionCodes)[keyof typeof permissionCodes];


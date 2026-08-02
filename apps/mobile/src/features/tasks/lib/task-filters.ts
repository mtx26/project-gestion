export function getFolderId(value: string): number | null {
  if (value.startsWith("folder-")) {
    return Number(value.replace("folder-", ""));
  }
  return null;
}

export function encodeFolderValue(id: number | null): string {
  return id == null ? "all" : `folder-${id}`;
}

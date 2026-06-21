import type { ComponentType } from "react";
import type { FolderTreeNode } from "@project-gestion/types";
import {
  FileArchive,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType,
} from "lucide-react";

export type FileActionTarget = {
  type: "folder" | "document";
  id: number;
  name: string;
};

export const TREE_INDENT = 28;
export const TREE_ROW_PADDING = 0;

export function getTreeRowPadding(depth: number): number {
  return depth * TREE_INDENT + TREE_ROW_PADDING;
}

export function getTreeContentPadding(depth: number): number {
  return getTreeRowPadding(depth) + 32;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function isFolderDescendantOf(
  nodes: FolderTreeNode[],
  ancestorId: number,
  candidateId: number,
): boolean {
  for (const node of nodes) {
    if (node.type !== "folder") continue;
    if (node.id === ancestorId) {
      return node.id === candidateId || containsFolderId(node.children ?? [], candidateId);
    }
    if (isFolderDescendantOf(node.children ?? [], ancestorId, candidateId)) return true;
  }
  return false;
}

export function containsFolderId(nodes: FolderTreeNode[], id: number): boolean {
  for (const node of nodes) {
    if (node.type !== "folder") continue;
    if (node.id === id) return true;
    if (containsFolderId(node.children ?? [], id)) return true;
  }
  return false;
}

export function getDocumentIconConfig(node: FolderTreeNode): {
  Icon: ComponentType<{ className?: string }>;
  className: string;
} {
  const fileName = (node.file_name || node.name).toLowerCase();
  const extension = fileName.includes(".") ? fileName.split(".").pop() : "";
  const mimeType = node.mime_type?.toLowerCase() ?? "";

  if (
    mimeType.startsWith("image/") ||
    ["jpg", "jpeg", "png", "webp", "gif", "svg", "heic", "heif"].includes(extension ?? "")
  ) {
    return { Icon: FileImage, className: "text-sky-600" };
  }
  if (["xls", "xlsx", "csv"].includes(extension ?? "")) {
    return { Icon: FileSpreadsheet, className: "text-emerald-600" };
  }
  if (["zip", "rar", "7z", "tar", "gz"].includes(extension ?? "")) {
    return { Icon: FileArchive, className: "text-violet-600" };
  }
  if (["html", "css", "js", "jsx", "ts", "tsx", "json", "xml"].includes(extension ?? "")) {
    return { Icon: FileCode, className: "text-fuchsia-600" };
  }
  if (["pdf", "doc", "docx", "txt", "md", "rtf"].includes(extension ?? "")) {
    return { Icon: FileText, className: "text-muted-foreground" };
  }
  return { Icon: FileType, className: "text-muted-foreground" };
}

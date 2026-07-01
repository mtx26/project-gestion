import type { ComponentType } from "react";
import {
  FileArchive,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType,
} from "lucide-react";

export { formatBytes as formatFileSize } from "@/lib/task-utils";

export type FileLike = {
  name?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
};

export function isImageFile(file: FileLike): boolean {
  const fileName = (file.file_name || file.name || "").toLowerCase();
  const extension = fileName.includes(".") ? fileName.split(".").pop() : "";
  const mimeType = file.mime_type?.toLowerCase() ?? "";
  return (
    mimeType.startsWith("image/") ||
    ["jpg", "jpeg", "png", "webp", "gif", "svg", "heic", "heif"].includes(extension ?? "")
  );
}

export function getDocumentIconConfig(file: FileLike): {
  Icon: ComponentType<{ className?: string }>;
  className: string;
} {
  const fileName = (file.file_name || file.name || "").toLowerCase();
  const extension = fileName.includes(".") ? fileName.split(".").pop() : "";

  if (isImageFile(file)) {
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

export function getFileTypeLabel(file: FileLike): string {
  const fileName = file.file_name || file.name || "";
  const mimeType = file.mime_type?.toLowerCase() ?? "";
  const ext = fileName.split(".").pop()?.toUpperCase();

  if (!mimeType) return ext || "Fichier";
  if (mimeType.startsWith("image/")) return "Image";
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "Tableur";
  if (mimeType.includes("word") || mimeType.includes("document")) return "Document";
  if (mimeType.startsWith("video/")) return "Video";
  if (mimeType.startsWith("audio/")) return "Audio";
  return ext || "Fichier";
}

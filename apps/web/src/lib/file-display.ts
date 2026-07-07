import type { ComponentType } from "react";
import {
  FileArchive,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType,
} from "lucide-react";

export type FileLike = {
  name?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
};

function getExtension(file: FileLike): string {
  const fileName = (file.file_name || file.name || "").toLowerCase();
  return fileName.includes(".") ? fileName.split(".").pop()! : "";
}

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif", "svg", "heic", "heif"];

export function isImageFile(file: FileLike): boolean {
  const mimeType = file.mime_type?.toLowerCase() ?? "";
  return mimeType.startsWith("image/") || IMAGE_EXTENSIONS.includes(getExtension(file));
}

const ICON_BY_EXTENSION: Array<{ extensions: string[]; Icon: ComponentType<{ className?: string }>; className: string }> = [
  { extensions: ["xls", "xlsx", "csv"], Icon: FileSpreadsheet, className: "text-emerald-600" },
  { extensions: ["zip", "rar", "7z", "tar", "gz"], Icon: FileArchive, className: "text-violet-600" },
  { extensions: ["html", "css", "js", "jsx", "ts", "tsx", "json", "xml"], Icon: FileCode, className: "text-fuchsia-600" },
  { extensions: ["pdf", "doc", "docx", "txt", "md", "rtf"], Icon: FileText, className: "text-muted-foreground" },
];

export function getDocumentIconConfig(file: FileLike): {
  Icon: ComponentType<{ className?: string }>;
  className: string;
} {
  if (isImageFile(file)) {
    return { Icon: FileImage, className: "text-sky-600" };
  }
  const extension = getExtension(file);
  const match = ICON_BY_EXTENSION.find((entry) => entry.extensions.includes(extension));
  return match ?? { Icon: FileType, className: "text-muted-foreground" };
}

export function getFileTypeLabel(file: FileLike): string {
  const mimeType = file.mime_type?.toLowerCase() ?? "";
  const extensionLabel = getExtension(file).toUpperCase() || "Fichier";

  if (mimeType.startsWith("image/")) return "Image";
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "Tableur";
  if (mimeType.includes("word") || mimeType.includes("document")) return "Document";
  if (mimeType.startsWith("video/")) return "Video";
  if (mimeType.startsWith("audio/")) return "Audio";
  return extensionLabel;
}

import {
  Attachment,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment";
import { DocumentThumbnail } from "@/components/documents/document-thumbnail";
import { formatFileSize, getDocumentIconConfig, getFileTypeLabel, isImageFile, type FileLike } from "@/lib/file-display";
import { cn } from "@/lib/utils";

interface FileAttachmentProps {
  file: FileLike & { file_size?: number | null };
  /** Set together with the project id to fetch a real thumbnail for an already-uploaded image. */
  documentId?: number;
  projectId?: number;
  /** Local preview (e.g. `URL.createObjectURL`) for a file not uploaded yet. */
  previewSrc?: string;
  state?: "idle" | "uploading" | "processing" | "error" | "done";
  errorMessage?: string;
  /** Appended after the type/size line, e.g. "Supprime il y a 2 jours". */
  descriptionSuffix?: string;
  size?: "default" | "sm" | "xs";
  orientation?: "horizontal" | "vertical";
  actions?: React.ReactNode;
  className?: string;
}

export function FileAttachment({
  file,
  documentId,
  projectId,
  previewSrc,
  state = "done",
  errorMessage,
  descriptionSuffix,
  size = "default",
  orientation = "horizontal",
  actions,
  className,
}: FileAttachmentProps) {
  const { Icon, className: iconClassName } = getDocumentIconConfig(file);
  const showThumbnail = isImageFile(file) && Boolean(previewSrc || (documentId != null && projectId != null));
  const name = file.file_name || file.name || "Document";
  const sizeLabel = file.file_size ? formatFileSize(file.file_size) : null;
  const typeLabel = getFileTypeLabel(file);

  return (
    <Attachment state={state} size={size} orientation={orientation} className={className}>
      <AttachmentMedia variant={showThumbnail ? "image" : "icon"}>
        {showThumbnail ? (
          previewSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewSrc} alt={name} />
          ) : (
            <DocumentThumbnail
              projectId={projectId!}
              documentId={documentId!}
              alt={name}
              fallback={<Icon className={iconClassName} />}
            />
          )
        ) : (
          <Icon className={cn(state !== "error" && iconClassName)} />
        )}
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>{name}</AttachmentTitle>
        <AttachmentDescription>
          {state === "error" && errorMessage
            ? errorMessage
            : state === "uploading"
              ? "Envoi en cours…"
              : `${typeLabel}${sizeLabel ? ` · ${sizeLabel}` : ""}${descriptionSuffix ? ` · ${descriptionSuffix}` : ""}`}
        </AttachmentDescription>
      </AttachmentContent>
      {actions ? <AttachmentActions>{actions}</AttachmentActions> : null}
    </Attachment>
  );
}

"use client";

import type { DocumentInfo } from "@project-gestion/types";
import { Plus, X } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { FileAttachment } from "@/components/documents/file-attachment";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface MultiDocumentAttachmentFieldProps {
  projectId: number;
  existingDocs: DocumentInfo[];
  pendingFiles: globalThis.File[];
  uploading?: boolean;
  onRemoveDoc: (id: number) => void;
  onAddFiles: (files: globalThis.File[]) => void;
  onRemoveFile: (index: number) => void;
}

export function MultiDocumentAttachmentField({
  projectId,
  existingDocs,
  pendingFiles,
  uploading = false,
  onRemoveDoc,
  onAddFiles,
  onRemoveFile,
}: MultiDocumentAttachmentFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrls = useMemo(() => pendingFiles.map((file) => URL.createObjectURL(file)), [pendingFiles]);
  // Revoque le lot precedent d'URLs objet a chaque changement de pendingFiles
  // (et au demontage) pour eviter de fuir un blob par fichier ajoute/retire.
  useEffect(() => {
    return () => previewUrls.forEach((url) => URL.revokeObjectURL(url));
  }, [previewUrls]);

  return (
    <div className="flex flex-col gap-2">
      <Label>Documents justificatifs (optionnel)</Label>

      {existingDocs.length > 0 || pendingFiles.length > 0 ? (
        <div className="flex flex-col gap-2">
          {existingDocs.map((doc) => (
            <FileAttachment
              key={doc.id}
              file={{ name: doc.name ?? `Document #${doc.id}`, mime_type: doc.mime_type, file_size: doc.file_size }}
              documentId={doc.id}
              projectId={projectId}
              size="sm"
              actions={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => onRemoveDoc(doc.id)}
                >
                  <X className="size-4" />
                </Button>
              }
            />
          ))}

          {pendingFiles.map((file, index) => (
            <FileAttachment
              key={index}
              file={{ name: file.name, mime_type: file.type }}
              previewSrc={previewUrls[index]}
              state={uploading ? "uploading" : "idle"}
              size="sm"
              actions={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => onRemoveFile(index)}
                  disabled={uploading}
                >
                  <X className="size-4" />
                </Button>
              }
            />
          ))}
        </div>
      ) : null}

      <Input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length > 0) onAddFiles(files);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit gap-1.5"
        onClick={() => fileInputRef.current?.click()}
      >
        <Plus className="size-4" />
        Ajouter un fichier
      </Button>
    </div>
  );
}

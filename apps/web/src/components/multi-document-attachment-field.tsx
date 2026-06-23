"use client";

import { Paperclip, Plus, X } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ExistingDoc = { id: number; name: string | null };

interface MultiDocumentAttachmentFieldProps {
  existingDocs: ExistingDoc[];
  pendingFiles: globalThis.File[];
  onRemoveDoc: (id: number) => void;
  onAddFiles: (files: globalThis.File[]) => void;
  onRemoveFile: (index: number) => void;
}

export function MultiDocumentAttachmentField({
  existingDocs,
  pendingFiles,
  onRemoveDoc,
  onAddFiles,
  onRemoveFile,
}: MultiDocumentAttachmentFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-2">
      <Label>Documents justificatifs (optionnel)</Label>

      {existingDocs.map((doc) => (
        <div
          key={doc.id}
          className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm"
        >
          <Paperclip className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-muted-foreground">
            {doc.name ?? `Document #${doc.id}`}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-destructive hover:text-destructive"
            onClick={() => onRemoveDoc(doc.id)}
          >
            <X className="size-4" />
          </Button>
        </div>
      ))}

      {pendingFiles.map((file, index) => (
        <div key={index} className="flex items-center gap-2 text-xs text-muted-foreground">
          <Paperclip className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{file.name}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-destructive hover:text-destructive"
            onClick={() => onRemoveFile(index)}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      ))}

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

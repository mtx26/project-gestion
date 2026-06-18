"use client";

import { Paperclip, X } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DocumentAttachmentField({
  documentId,
  documentName,
  selectedFile,
  onFileChange,
  onClearDocument,
}: {
  documentId: number | null;
  documentName?: string | null;
  selectedFile: globalThis.File | null;
  onFileChange: (file: globalThis.File | null) => void;
  onClearDocument: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function clearAll() {
    onClearDocument();
    onFileChange(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>Document justificatif (optionnel)</Label>

      {documentId && !selectedFile ? (
        <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <Paperclip className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 truncate text-muted-foreground">
            {documentName ?? `Document #${documentId}`}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="ml-auto shrink-0 text-destructive hover:text-destructive"
            onClick={clearAll}
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : null}

      {!documentId || selectedFile ? (
        <Input
          ref={fileInputRef}
          type="file"
          className="cursor-pointer"
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
        />
      ) : null}

      {selectedFile ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Paperclip className="size-3.5 shrink-0" />
          <span className="min-w-0 truncate">{selectedFile.name}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="ml-auto shrink-0 text-destructive hover:text-destructive"
            onClick={() => {
              onFileChange(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

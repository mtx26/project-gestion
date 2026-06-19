"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";

export type PreviewDocument = {
  url: string;
  file_name: string;
  mime_type: string | null;
};

function getDocumentPreviewKind(doc: PreviewDocument): "image" | "pdf" | "none" {
  const mime = doc.mime_type ?? "";
  const ext = (doc.file_name.split(".").pop() ?? "").toLowerCase();
  if (mime.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext)) return "image";
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  return "none";
}

interface DocumentPreviewModalProps {
  document: PreviewDocument | null;
  onClose: () => void;
}

export function DocumentPreviewModal({
  document: doc,
  onClose,
}: DocumentPreviewModalProps) {
  const kind = doc ? getDocumentPreviewKind(doc) : "none";

  return (
    <Dialog open={doc != null} onOpenChange={(open) => !open && onClose()}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content className="fixed inset-0 z-50 flex flex-col bg-background">
          <DialogTitle className="sr-only">{doc?.file_name ?? "Apercu"}</DialogTitle>
          <div className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-3">
            <span className="truncate text-sm font-medium">{doc?.file_name ?? "Apercu"}</span>
            <div className="flex shrink-0 items-center gap-2">
              {doc ? (
                <a href={doc.url} target="_blank" rel="noopener noreferrer">
                  <Button type="button" variant="outline" size="sm">
                    <Download className="size-4" />
                    Telecharger
                  </Button>
                </a>
              ) : null}
              <DialogClose asChild>
                <Button type="button" variant="outline" size="sm">Fermer</Button>
              </DialogClose>
            </div>
          </div>
          {doc ? (
            <div className="min-h-0 flex-1 overflow-hidden">
              {kind === "image" ? (
                <div className="flex h-full items-center justify-center bg-muted/20 p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={doc.url} alt={doc.file_name} className="max-h-full w-auto object-contain" />
                </div>
              ) : kind === "pdf" ? (
                <object data={doc.url} type="application/pdf" className="h-full w-full" aria-label={doc.file_name}>
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
                    <p>Impossible d&apos;afficher le PDF dans le navigateur.</p>
                    <a href={doc.url} target="_blank" rel="noopener noreferrer">
                      <Button type="button" variant="outline">
                        <Download className="size-4" />
                        Ouvrir le PDF
                      </Button>
                    </a>
                  </div>
                </object>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-4">
                  <p className="text-sm text-muted-foreground">Apercu non disponible pour ce type de fichier.</p>
                  <a href={doc.url} target="_blank" rel="noopener noreferrer">
                    <Button type="button">
                      <Download className="size-4" />
                      Telecharger {doc.file_name}
                    </Button>
                  </a>
                </div>
              )}
            </div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

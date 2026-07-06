"use client";

import { useState } from "react";
import type { PreviewDocument } from "@/components/dialogs/document-preview-dialog";
import { api } from "@/lib/api";
import { useCrudMutation } from "@/lib/use-crud-mutation";

export function useDocumentPreview(projectId: number | null) {
  const [previewDocument, setPreviewDocument] = useState<PreviewDocument | null>(null);

  const openDocument = useCrudMutation({
    mutationFn: (documentId: number) => api.documents.download(projectId!, documentId),
    errorMessage: "Impossible de charger le document",
    onSuccess: setPreviewDocument,
  });

  return { openDocument, previewDocument, setPreviewDocument };
}

"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { PreviewDocument } from "@/components/dialogs/document-preview-modal";
import { api } from "@/lib/api";
import { toastError } from "@/lib/errors";

export function useDocumentPreview(projectId: number | null) {
  const [previewDocument, setPreviewDocument] = useState<PreviewDocument | null>(null);

  const openDocument = useMutation({
    mutationFn: (documentId: number) => api.documents.download(projectId!, documentId),
    onSuccess: (data) => setPreviewDocument(data),
    onError: toastError,
  });

  return { openDocument, previewDocument, setPreviewDocument };
}

"use client";

import type { File as ApiFile } from "@project-gestion/types";
import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";

export function useDocumentAttachment(initialDocs: Array<{ id: number; name: string | null }>) {
  const initial = useRef(initialDocs);
  const [existingDocs, setExistingDocs] = useState(() => initialDocs);
  const [pendingFiles, setPendingFiles] = useState<globalThis.File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  function reset() {
    setExistingDocs(initial.current);
    setPendingFiles([]);
    setUploadError(null);
  }

  async function uploadPending(projectId: number, folderId: number | null | undefined): Promise<number[] | null> {
    setUploadError(null);
    if (pendingFiles.length === 0) return [];
    setUploading(true);
    const newDocIds: number[] = [];
    try {
      for (const file of pendingFiles) {
        const uploaded: ApiFile = await api.documents.upload(projectId, {
          file,
          folder: folderId ?? undefined,
          name: file.name,
        });
        newDocIds.push(uploaded.id);
      }
    } catch (err) {
      setUploadError(getErrorMessage(err));
      setUploading(false);
      return null;
    }
    setUploading(false);
    return newDocIds;
  }

  return {
    existingDocs,
    pendingFiles,
    uploading,
    uploadError,
    reset,
    uploadPending,
    getAllDocIds: (newIds: number[]) => [...existingDocs.map((d) => d.id), ...newIds],
    removeExistingDoc: (id: number) => setExistingDocs((prev) => prev.filter((d) => d.id !== id)),
    addPendingFiles: (files: globalThis.File[]) => setPendingFiles((prev) => [...prev, ...files]),
    removePendingFile: (index: number) => setPendingFiles((prev) => prev.filter((_, i) => i !== index)),
  };
}

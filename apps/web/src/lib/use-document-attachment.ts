"use client";

import type { DocumentInfo, File as ApiFile } from "@project-gestion/types";
import { documentUploadLimits } from "@project-gestion/config";
import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";

/** Rejects up front what the backend's `validate_document_file` would reject anyway
 * (`api/services/storage.py`), so the user finds out before filling out the rest
 * of the form instead of after a failed submit. */
export function validateDocumentFile(file: globalThis.File): string | null {
  if (file.size > documentUploadLimits.maxSizeBytes) {
    const maxMb = Math.round(documentUploadLimits.maxSizeBytes / (1024 * 1024));
    return `${file.name} : le fichier depasse la taille maximale (${maxMb} Mo).`;
  }
  const extension = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
  if (!documentUploadLimits.allowedExtensions.has(extension)) {
    return `${file.name} : type de fichier non autorise.`;
  }
  return null;
}

/** Manages a form's document attachments (already-linked docs + newly picked
 * files pending upload). On submit, call `resolveDocumentIds(projectId, folderId)`
 * — it uploads pending files and returns the full id list (existing + new) to send
 * with the form payload, or `null` if the upload failed (bail out without calling
 * `onSubmit`). Call `reset()` after a successful submit or when the dialog closes.
 * See any existing `<Feature>FormDialog` for a full example. */
export function useDocumentAttachment(initialDocs: DocumentInfo[]) {
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

  async function resolveDocumentIds(
    projectId: number,
    folderId: number | null | undefined,
  ): Promise<number[] | null> {
    setUploadError(null);
    if (pendingFiles.length === 0) return existingDocs.map((d) => d.id);
    setUploading(true);
    try {
      const uploaded = await Promise.all(
        pendingFiles.map((file): Promise<ApiFile> =>
          api.documents.upload(projectId, { file, folder: folderId ?? undefined, name: file.name }),
        ),
      );
      return [...existingDocs.map((d) => d.id), ...uploaded.map((doc) => doc.id)];
    } catch (err) {
      setUploadError(getErrorMessage(err));
      return null;
    } finally {
      setUploading(false);
    }
  }

  return {
    existingDocs,
    pendingFiles,
    uploading,
    uploadError,
    reset,
    resolveDocumentIds,
    removeExistingDoc: (id: number) => setExistingDocs((prev) => prev.filter((d) => d.id !== id)),
    addPendingFiles: (files: globalThis.File[]) => {
      const rejection = files.map(validateDocumentFile).find((message) => message !== null);
      if (rejection) {
        setUploadError(rejection);
        return;
      }
      setUploadError(null);
      setPendingFiles((prev) => [...prev, ...files]);
    },
    removePendingFile: (index: number) => setPendingFiles((prev) => prev.filter((_, i) => i !== index)),
  };
}

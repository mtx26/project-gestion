import { validateUploadCandidate } from "@project-gestion/domain";
import type { DocumentInfo, File as ApiFile } from "@project-gestion/types";
import { useRef, useState } from "react";
import { api } from "./api";
import type { PendingUpload } from "./document-picker";
import { getErrorMessage } from "./errors";

/** Gere les pieces jointes d'un formulaire (documents deja lies + fichiers choisis
 * en attente d'envoi). A la soumission, appeler `resolveDocumentIds(projectId, folderId)` :
 * il envoie les fichiers en attente et renvoie la liste complete des identifiants a
 * mettre dans le payload, ou `null` si un envoi a echoue (dans ce cas, ne pas soumettre).
 * Meme contrat que `useDocumentAttachment` cote web. */
export function useDocumentAttachment(initialDocs: DocumentInfo[]) {
  const initial = useRef(initialDocs);
  const [existingDocs, setExistingDocs] = useState(() => initialDocs);
  const [pendingFiles, setPendingFiles] = useState<PendingUpload[]>([]);
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
    if (pendingFiles.length === 0) return existingDocs.map((doc) => doc.id);
    setUploading(true);
    try {
      const uploaded = await Promise.all(
        pendingFiles.map((file): Promise<ApiFile> =>
          api.documents.upload(projectId, { file, folder: folderId ?? undefined, name: file.name }),
        ),
      );
      return [...existingDocs.map((doc) => doc.id), ...uploaded.map((doc) => doc.id)];
    } catch (error) {
      setUploadError(getErrorMessage(error));
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
    setUploadError,
    removeExistingDoc: (id: number) => setExistingDocs((prev) => prev.filter((doc) => doc.id !== id)),
    addPendingFiles: (files: PendingUpload[]) => {
      const rejection = files.map(validateUploadCandidate).find((message) => message !== null);
      if (rejection) {
        setUploadError(rejection);
        return;
      }
      setUploadError(null);
      setPendingFiles((prev) => [...prev, ...files]);
    },
    removePendingFile: (index: number) => setPendingFiles((prev) => prev.filter((_, position) => position !== index)),
  };
}

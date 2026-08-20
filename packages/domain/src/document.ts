import { documentUploadLimits } from "@project-gestion/config";

/** Ce qu'il faut savoir d'un fichier pour le valider, quelle que soit sa forme reelle :
 * un `File` du navigateur cote web, un descripteur `{ uri, name, type }` cote mobile. */
export interface UploadCandidate {
  name: string;
  /** `null`/`undefined` quand la plateforme ne l'expose pas : la taille n'est alors pas
   * verifiee ici, le backend restant de toute facon la derniere barriere. */
  size?: number | null;
}

/** Refuse en amont ce que `validate_document_file` refuserait cote backend
 * (`api/services/storage.py`), pour que l'utilisateur le sache au moment du choix du
 * fichier et pas apres un envoi rate. Renvoie le message a afficher, ou `null` si le
 * fichier passe. */
export function validateUploadCandidate(file: UploadCandidate): string | null {
  if (file.size != null && file.size > documentUploadLimits.maxSizeBytes) {
    const maxMb = Math.round(documentUploadLimits.maxSizeBytes / (1024 * 1024));
    return `${file.name} : le fichier depasse la taille maximale (${maxMb} Mo).`;
  }
  const extension = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
  if (!documentUploadLimits.allowedExtensions.has(extension)) {
    return `${file.name} : type de fichier non autorise.`;
  }
  return null;
}

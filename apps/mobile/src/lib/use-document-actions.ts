import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as WebBrowser from "expo-web-browser";
import { useMutation } from "@tanstack/react-query";
import { api } from "./api";

/** L'API renvoie une URL signee de courte duree ; les deux actions ci-dessous
 * partent toujours de la, plutot que de deviner une URL de stockage. */
function requestDownloadUrl(projectId: number, documentId: number) {
  return api.documents.download(projectId, documentId);
}

/** Ouvre le document dans le navigateur integre a l'app (onglet Safari/Chrome
 * personnalise) : l'utilisateur reste dans l'application et revient d'un geste,
 * contrairement a `Linking.openURL` qui bascule vers le navigateur du systeme. */
export function useOpenDocument(projectId: number | null) {
  return useMutation({
    mutationFn: async (documentId: number) => {
      const document = await requestDownloadUrl(projectId!, documentId);
      await WebBrowser.openBrowserAsync(document.url);
    },
  });
}

/** Telecharge le document dans le cache de l'app puis ouvre la feuille de partage
 * du systeme — c'est elle qui offre "Enregistrer dans Fichiers", l'envoi par mail
 * ou vers une autre app. Le cache (et pas le dossier documents) : le systeme peut
 * le vider, et un justificatif n'a pas a vivre deux fois sur le telephone. */
export function useShareDocument(projectId: number | null) {
  return useMutation({
    mutationFn: async (documentId: number) => {
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error("Le partage n'est pas disponible sur cet appareil.");
      }
      const document = await requestDownloadUrl(projectId!, documentId);
      const destination = new File(Paths.cache, document.file_name);
      // `idempotent` : re-partager le meme document ecrase la copie precedente au
      // lieu d'echouer sur un fichier deja present.
      const downloaded = await File.downloadFileAsync(document.url, destination, { idempotent: true });

      await Sharing.shareAsync(downloaded.uri, {
        mimeType: document.mime_type ?? undefined,
        dialogTitle: document.file_name,
      });
    },
  });
}

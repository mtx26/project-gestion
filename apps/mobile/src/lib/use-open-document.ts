import { useMutation } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { api } from "./api";

/** Ouvre un document dans le visualiseur du systeme : l'API renvoie une URL signee
 * de courte duree, que la plateforme affiche elle-meme (Safari/Chrome, apercu PDF,
 * galerie...). Equivalent natif du DocumentPreviewDialog du web, sans avoir a
 * telecharger le fichier dans l'app. */
export function useOpenDocument(projectId: number | null) {
  return useMutation({
    mutationFn: async (documentId: number) => {
      const document = await api.documents.download(projectId!, documentId);
      await Linking.openURL(document.url);
    },
  });
}

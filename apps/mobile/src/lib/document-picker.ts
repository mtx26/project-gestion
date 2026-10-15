import type { UploadFileDescriptor } from "@project-gestion/types";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";

/** Fichier choisi mais pas encore envoye. `uri`/`name`/`type` sont ce que le
 * `FormData` de React Native attend pour construire la partie multipart ; `size`
 * ne sert qu'a la validation et a l'affichage. */
export type PendingUpload = UploadFileDescriptor & { size?: number | null };

function toImageUpload(asset: ImagePicker.ImagePickerAsset): PendingUpload {
  // `fileName` est absent quand la photo vient de l'appareil photo ou d'un acces
  // limite a la photothegue : on retombe sur l'extension du fichier temporaire.
  const fallbackExtension = asset.uri.split(".").pop()?.toLowerCase() || "jpg";
  const name = asset.fileName || `photo-${Date.now()}.${fallbackExtension}`;
  return {
    uri: asset.uri,
    name,
    type: asset.mimeType || `image/${fallbackExtension === "jpg" ? "jpeg" : fallbackExtension}`,
    size: asset.fileSize ?? null,
  };
}

/** Explorateur de fichiers du systeme (Fichiers/iCloud sur iOS, SAF sur Android). */
export async function pickDocuments(): Promise<PendingUpload[]> {
  const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
  if (result.canceled) {
    return [];
  }
  return result.assets.map((asset) => ({
    uri: asset.uri,
    name: asset.name,
    type: asset.mimeType || "application/octet-stream",
    size: asset.size ?? null,
  }));
}

/** `allowsEditing` ouvre l'outil de recadrage du systeme (et impose une seule image) :
 * c'est ce qu'on veut pour une photo de profil, pas pour des justificatifs. */
export interface ImagePickOptions {
  allowsEditing?: boolean;
}

export async function pickImages({ allowsEditing = false }: ImagePickOptions = {}): Promise<PendingUpload[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: !allowsEditing,
    allowsEditing,
  });
  if (result.canceled) {
    return [];
  }
  return result.assets.map(toImageUpload);
}

/** `null` quand l'utilisateur refuse l'acces a l'appareil photo — l'appelant
 * affiche alors le message d'explication plutot qu'un ecran vide. */
export async function captureImage({ allowsEditing = false }: ImagePickOptions = {}): Promise<
  PendingUpload[] | null
> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], allowsEditing });
  if (result.canceled) {
    return [];
  }
  return result.assets.map(toImageUpload);
}

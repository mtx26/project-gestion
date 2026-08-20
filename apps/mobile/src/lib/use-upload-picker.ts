import { Alert } from "react-native";
import { useActionSheet } from "../providers/ActionSheetProvider";
import { captureImage, pickDocuments, pickImages, type PendingUpload } from "./document-picker";

interface UploadPickerOptions {
  /** Ouvre le recadrage du systeme et limite a une image (photo de profil). */
  allowsEditing?: boolean;
  /** Propose l'explorateur de fichiers en plus de l'appareil photo et des photos. */
  includeFiles?: boolean;
}

/** Le choix "appareil photo / photothegue / fichiers", partage par tous les points
 * d'import de l'app (pieces jointes, explorateur de fichiers, photo de profil) :
 * meme libelles, meme gestion du refus de permission, un seul endroit a corriger. */
export function useUploadPicker() {
  const showActionSheet = useActionSheet();

  return function pickUpload(
    onPicked: (files: PendingUpload[]) => void,
    { allowsEditing = false, includeFiles = true }: UploadPickerOptions = {},
  ) {
    async function run(pick: () => Promise<PendingUpload[] | null>) {
      const files = await pick();
      // `null` = permission appareil photo refusee : l'utilisateur doit passer par
      // les reglages du systeme, l'app ne peut plus redemander.
      if (files === null) {
        Alert.alert(
          "Acces refuse",
          "Autorise l'appareil photo dans les reglages du telephone pour prendre une photo.",
        );
        return;
      }
      if (files.length > 0) {
        onPicked(files);
      }
    }

    showActionSheet(
      "Ajouter un fichier",
      [
        { label: "Prendre une photo", value: "camera" },
        { label: "Choisir dans les photos", value: "library" },
        ...(includeFiles ? [{ label: "Choisir un fichier", value: "files" }] : []),
      ],
      (value) => {
        if (value === "camera") {
          void run(() => captureImage({ allowsEditing }));
        } else if (value === "library") {
          void run(() => pickImages({ allowsEditing }));
        } else {
          void run(pickDocuments);
        }
      },
    );
  };
}

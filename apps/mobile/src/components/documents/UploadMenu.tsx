import type { ReactNode } from "react";
import { Alert, type StyleProp, type ViewStyle } from "react-native";
import {
  captureImage,
  pickDocuments,
  pickImages,
  type PendingUpload,
} from "../../lib/document-picker";
import { SelectMenu, type SelectMenuOption } from "../menus/SelectMenu";

interface UploadMenuProps {
  onPicked: (files: PendingUpload[]) => void;
  /** Ouvre le recadrage du systeme et limite a une image (photo de profil). */
  allowsEditing?: boolean;
  /** Propose l'explorateur de fichiers en plus de l'appareil photo et des photos. */
  includeFiles?: boolean;
  /** Le declencheur, ancre du menu. Il ne doit pas gerer le tap lui-meme. */
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Le choix "appareil photo / phototheque / fichiers", partage par tous les points
 * d'import de l'app (pieces jointes, explorateur de fichiers, photo de profil) :
 * meme libelles, meme gestion du refus de permission, un seul endroit a corriger.
 *
 * Un composant et non un hook : le menu natif s'ancre sous son declencheur, il ne
 * peut pas etre ouvert depuis un `onPress`. */
export function UploadMenu({
  onPicked,
  allowsEditing = false,
  includeFiles = true,
  children,
  style,
}: UploadMenuProps) {
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

  const options: SelectMenuOption[] = [
    { label: "Prendre une photo", value: "camera" },
    { label: "Choisir dans les photos", value: "library" },
    ...(includeFiles ? [{ label: "Choisir un fichier", value: "files" }] : []),
  ];

  return (
    <SelectMenu
      title="Ajouter un fichier"
      options={options}
      onSelect={(value) => {
        if (value === "camera") {
          void run(() => captureImage({ allowsEditing }));
        } else if (value === "library") {
          void run(() => pickImages({ allowsEditing }));
        } else {
          void run(pickDocuments);
        }
      }}
      style={style}
    >
      {children}
    </SelectMenu>
  );
}

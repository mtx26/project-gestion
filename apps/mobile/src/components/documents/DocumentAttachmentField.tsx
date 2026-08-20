import type { DocumentInfo } from "@project-gestion/types";
import { Paperclip, X } from "lucide-react-native";
import { Alert, Pressable, Text, View } from "react-native";
import { useActionSheet } from "../../providers/ActionSheetProvider";
import { captureImage, pickDocuments, pickImages, type PendingUpload } from "../../lib/document-picker";
import { theme } from "../../theme";
import { DocumentRow } from "./DocumentRow";

interface DocumentAttachmentFieldProps {
  existingDocs: DocumentInfo[];
  pendingFiles: PendingUpload[];
  uploading?: boolean;
  onRemoveDoc: (id: number) => void;
  onAddFiles: (files: PendingUpload[]) => void;
  onRemoveFile: (index: number) => void;
}

/** Champ "pieces jointes" d'un formulaire — equivalent natif du
 * MultiDocumentAttachmentField du web : au lieu d'un `<input type="file">`, un
 * choix natif entre appareil photo, photothegue et explorateur de fichiers. */
export function DocumentAttachmentField({
  existingDocs,
  pendingFiles,
  uploading = false,
  onRemoveDoc,
  onAddFiles,
  onRemoveFile,
}: DocumentAttachmentFieldProps) {
  const showActionSheet = useActionSheet();

  async function runPicker(pick: () => Promise<PendingUpload[] | null>) {
    const files = await pick();
    if (files === null) {
      Alert.alert(
        "Acces refuse",
        "Autorise l'appareil photo dans les reglages du telephone pour photographier un justificatif.",
      );
      return;
    }
    if (files.length > 0) {
      onAddFiles(files);
    }
  }

  function openPicker() {
    showActionSheet(
      "Ajouter un fichier",
      [
        { label: "Prendre une photo", value: "camera" },
        { label: "Choisir dans les photos", value: "library" },
        { label: "Choisir un fichier", value: "files" },
      ],
      (value) => {
        if (value === "camera") {
          void runPicker(captureImage);
        } else if (value === "library") {
          void runPicker(pickImages);
        } else {
          void runPicker(pickDocuments);
        }
      },
    );
  }

  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-foreground">Documents justificatifs (optionnel)</Text>

      {existingDocs.map((doc) => (
        <DocumentRow
          key={doc.id}
          name={doc.name ?? `Document #${doc.id}`}
          mimeType={doc.mime_type}
          size={doc.file_size}
          trailing={
            <Pressable
              onPress={() => onRemoveDoc(doc.id)}
              accessibilityRole="button"
              accessibilityLabel={`Retirer ${doc.name ?? `document #${doc.id}`}`}
              hitSlop={8}
              className="h-11 w-11 items-center justify-center"
            >
              <X size={theme.iconSize.sm} color={theme.colors.danger} />
            </Pressable>
          }
        />
      ))}

      {pendingFiles.map((file, index) => (
        <DocumentRow
          key={`${file.uri}-${index}`}
          name={file.name}
          mimeType={file.type}
          size={file.size}
          pending={uploading}
          trailing={
            <Pressable
              onPress={() => onRemoveFile(index)}
              disabled={uploading}
              accessibilityRole="button"
              accessibilityLabel={`Retirer ${file.name}`}
              hitSlop={8}
              className="h-11 w-11 items-center justify-center"
              style={{ opacity: uploading ? 0.5 : 1 }}
            >
              <X size={theme.iconSize.sm} color={theme.colors.danger} />
            </Pressable>
          }
        />
      ))}

      <Pressable
        onPress={openPicker}
        accessibilityRole="button"
        className="h-11 flex-row items-center justify-center gap-2 rounded-md border border-border bg-surface"
      >
        <Paperclip size={theme.iconSize.sm} color={theme.colors.foreground} />
        <Text className="text-sm font-medium text-foreground">Ajouter un fichier</Text>
      </Pressable>
    </View>
  );
}

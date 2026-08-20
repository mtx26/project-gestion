import type { DocumentInfo } from "@project-gestion/types";
import { Paperclip, X } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import type { PendingUpload } from "../../lib/document-picker";
import { useUploadPicker } from "../../lib/use-upload-picker";
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
  const pickUpload = useUploadPicker();

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
        onPress={() => pickUpload(onAddFiles)}
        accessibilityRole="button"
        className="h-11 flex-row items-center justify-center gap-2 rounded-md border border-border bg-surface"
      >
        <Paperclip size={theme.iconSize.sm} color={theme.colors.foreground} />
        <Text className="text-sm font-medium text-foreground">Ajouter un fichier</Text>
      </Pressable>
    </View>
  );
}

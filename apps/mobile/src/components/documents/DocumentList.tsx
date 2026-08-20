import type { DocumentInfo } from "@project-gestion/types";
import { Text, View } from "react-native";
import { longPressFeedback } from "../../lib/haptics";
import { useActionSheet } from "../../providers/ActionSheetProvider";
import { DocumentRow } from "./DocumentRow";

interface DocumentListProps {
  documents: DocumentInfo[];
  isOpening?: boolean;
  onOpen: (documentId: number) => void;
  /** Absent = pas d'appui long : la ligne se contente d'ouvrir le document. */
  onShare?: (documentId: number) => void;
}

/** Pieces jointes d'une entree : un tap ouvre le document dans le navigateur
 * integre, un appui long propose de le partager (la feuille systeme couvre aussi
 * "Enregistrer dans Fichiers"). */
export function DocumentList({ documents, isOpening, onOpen, onShare }: DocumentListProps) {
  const showActionSheet = useActionSheet();

  if (documents.length === 0) {
    return null;
  }

  function openActions(document: DocumentInfo) {
    if (!onShare) {
      return;
    }
    longPressFeedback();
    showActionSheet(
      document.name ?? `Document #${document.id}`,
      [
        { label: "Ouvrir", value: "open" },
        { label: "Partager le fichier", value: "share" },
      ],
      (value) => (value === "open" ? onOpen(document.id) : onShare(document.id)),
    );
  }

  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-foreground">Pieces jointes ({documents.length})</Text>
      {documents.map((document) => (
        <DocumentRow
          key={document.id}
          name={document.name ?? `Document #${document.id}`}
          mimeType={document.mime_type}
          size={document.file_size}
          pending={isOpening}
          onPress={() => onOpen(document.id)}
          onLongPress={onShare ? () => openActions(document) : undefined}
        />
      ))}
    </View>
  );
}

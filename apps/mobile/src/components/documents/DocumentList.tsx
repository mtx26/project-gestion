import type { DocumentInfo } from "@project-gestion/types";
import { Text, View } from "react-native";
import { DocumentRow } from "./DocumentRow";

interface DocumentListProps {
  documents: DocumentInfo[];
  isOpening?: boolean;
  onOpen: (documentId: number) => void;
}

/** Pieces jointes d'une entree, en lecture seule : un tap ouvre le document dans
 * le visualiseur du systeme (voir `useOpenDocument`). */
export function DocumentList({ documents, isOpening, onOpen }: DocumentListProps) {
  if (documents.length === 0) {
    return null;
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
        />
      ))}
    </View>
  );
}

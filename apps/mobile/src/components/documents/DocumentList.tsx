import type { DocumentInfo } from "@project-gestion/types";
import { Text, View } from "react-native";
import { longPressFeedback } from "../../lib/haptics";
import { SelectMenu } from "../menus/SelectMenu";
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
  if (documents.length === 0) {
    return null;
  }

  const share = onShare;

  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-foreground">Pieces jointes ({documents.length})</Text>
      {documents.map((document) => {
        const name = document.name ?? `Document #${document.id}`;
        const row = (
          <DocumentRow
            name={name}
            mimeType={document.mime_type}
            size={document.file_size}
            pending={isOpening}
            onPress={() => onOpen(document.id)}
            hasActions={Boolean(share)}
          />
        );

        if (!share) {
          return <View key={document.id}>{row}</View>;
        }

        return (
          <SelectMenu
            key={document.id}
            title={name}
            options={[
              { label: "Ouvrir", value: "open" },
              { label: "Partager le fichier", value: "share" },
            ]}
            onSelect={(value) => (value === "open" ? onOpen(document.id) : share(document.id))}
            shouldOpenOnLongPress
            onOpenMenu={longPressFeedback}
          >
            {row}
          </SelectMenu>
        );
      })}
    </View>
  );
}

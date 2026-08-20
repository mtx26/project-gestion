import { useEffect, useState } from "react";
import { View } from "react-native";
import { Button } from "../ui/Button";
import { FormField } from "../ui/FormField";
import { InlineMessage } from "../ui/InlineMessage";
import { BottomSheet } from "./BottomSheet";

interface NameSheetProps {
  visible: boolean;
  title: string;
  label: string;
  /** Valeur de depart : le nom actuel pour un renommage, vide pour une creation. */
  initialValue?: string;
  submitLabel: string;
  isPending?: boolean;
  error?: string | null;
  onSubmit: (name: string) => void;
  onClose: () => void;
}

/** Saisie d'un seul nom en bottom sheet — le prompt derriere "Nouveau dossier" et
 * "Renommer". Un formulaire a un champ n'a pas besoin d'un ecran complet. */
export function NameSheet({
  visible,
  title,
  label,
  initialValue = "",
  submitLabel,
  isPending,
  error,
  onSubmit,
  onClose,
}: NameSheetProps) {
  const [name, setName] = useState(initialValue);

  // La feuille reste montee entre deux ouvertures : on repart de la valeur fournie a
  // chaque ouverture, sinon un renommage garderait le nom de l'element precedent.
  useEffect(() => {
    if (visible) {
      setName(initialValue);
    }
  }, [visible, initialValue]);

  const trimmed = name.trim();

  return (
    <BottomSheet visible={visible} title={title} onClose={onClose}>
      {error ? <InlineMessage variant="danger">{error}</InlineMessage> : null}

      <FormField
        label={label}
        value={name}
        onChangeText={setName}
        autoCapitalize="sentences"
        autoFocus
        returnKeyType="done"
        onSubmitEditing={() => trimmed && onSubmit(trimmed)}
      />

      <View className="pt-1">
        <Button onPress={() => onSubmit(trimmed)} disabled={!trimmed || isPending}>
          {isPending ? "Enregistrement..." : submitLabel}
        </Button>
      </View>
    </BottomSheet>
  );
}

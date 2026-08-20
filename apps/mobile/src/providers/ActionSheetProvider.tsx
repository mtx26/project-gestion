import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { ActionSheetIOS, Platform } from "react-native";
import { OptionSheet, type OptionSheetOption } from "../components/layout/OptionSheet";

export type ActionSheetOption = OptionSheetOption;

type ShowActionSheet = (
  title: string,
  options: ActionSheetOption[],
  onSelect: (value: string) => void,
  /** Valeur courante, pour la cocher dans la liste (Android seulement : l'action
   * sheet natif d'iOS n'a pas de notion de selection). */
  selectedValue?: string,
) => void;

interface PendingSheet {
  title: string;
  options: ActionSheetOption[];
  onSelect: (value: string) => void;
  selectedValue?: string;
}

const ActionSheetContext = createContext<ShowActionSheet | null>(null);

/** Choix unique natif : l'`ActionSheetIOS` du systeme sur iOS, une liste en bottom
 * sheet sur Android. Un provider plutot qu'une simple fonction, parce que le rendu
 * Android est un composant : c'est lui qui monte la feuille au-dessus de l'ecran
 * courant. */
export function ActionSheetProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingSheet | null>(null);

  const showActionSheet = useCallback<ShowActionSheet>((title, options, onSelect, selectedValue) => {
    if (Platform.OS === "ios") {
      const labels = [...options.map((option) => option.label), "Annuler"];
      const destructiveButtonIndex = options.findIndex((option) => option.destructive);

      ActionSheetIOS.showActionSheetWithOptions(
        {
          title,
          options: labels,
          cancelButtonIndex: labels.length - 1,
          destructiveButtonIndex: destructiveButtonIndex >= 0 ? destructiveButtonIndex : undefined,
        },
        (index) => {
          if (index < options.length) {
            onSelect(options[index].value);
          }
        },
      );
      return;
    }

    setPending({ title, options, onSelect, selectedValue });
  }, []);

  const value = useMemo(() => showActionSheet, [showActionSheet]);

  return (
    <ActionSheetContext.Provider value={value}>
      {children}
      <OptionSheet
        visible={pending != null}
        title={pending?.title ?? ""}
        options={pending?.options ?? []}
        selectedValue={pending?.selectedValue}
        onSelect={(selected) => pending?.onSelect(selected)}
        onClose={() => setPending(null)}
      />
    </ActionSheetContext.Provider>
  );
}

export function useActionSheet(): ShowActionSheet {
  const showActionSheet = useContext(ActionSheetContext);
  if (!showActionSheet) {
    throw new Error("useActionSheet doit etre utilise dans un <ActionSheetProvider>");
  }
  return showActionSheet;
}

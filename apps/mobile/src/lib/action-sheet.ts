import { ActionSheetIOS, Alert, Platform } from "react-native";

interface ActionSheetOption {
  label: string;
  value: string;
  destructive?: boolean;
}

/** Native single-choice picker: ActionSheetIOS on iOS, Alert buttons on Android. */
export function showActionSheet(
  title: string,
  options: ActionSheetOption[],
  onSelect: (value: string) => void,
) {
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

  Alert.alert(title, undefined, [
    ...options.map((option) => ({
      text: option.label,
      style: option.destructive ? ("destructive" as const) : ("default" as const),
      onPress: () => onSelect(option.value),
    })),
    { text: "Annuler", style: "cancel" as const },
  ]);
}

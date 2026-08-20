import { Text, View } from "react-native";
import { useBadgeStyle, type BadgeTone } from "./badge-colors";

interface BadgeProps {
  label: string;
  tone: BadgeTone;
}

/** Le rendu commun a tous les badges de statut. Chaque badge metier ne declare
 * plus que ses libelles et une teinte par valeur : la resolution clair/sombre et
 * le balisage vivent ici, en un seul endroit. */
export function Badge({ label, tone }: BadgeProps) {
  const style = useBadgeStyle(tone);

  return (
    <View style={{ backgroundColor: style.bg }} className="self-start rounded-full px-2.5 py-1">
      <Text style={{ color: style.text }} className="text-xs font-semibold">
        {label}
      </Text>
    </View>
  );
}

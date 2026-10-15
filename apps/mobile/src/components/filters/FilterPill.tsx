import { ChevronDown } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { theme } from "../../theme";
import { useInGlassBar } from "../ui/GlassBar";
import { GlassCapsule } from "../ui/GlassCapsule";

interface FilterPillBodyProps {
  label: string;
  /** Le filtre porte une valeur autre que son defaut : la capsule prend alors le
   * vert d'accentuation. Sans effet hors d'une `GlassBar`. */
  active?: boolean;
}

/** Le visuel seul de la pastille, sans gestion du tap. Sert de declencheur a
 * `SelectFilterPill` : `MenuView` fournit lui-meme le Pressable qui ouvre le menu,
 * et un second Pressable imbrique lui volerait l'evenement sur Android. */
export function FilterPillBody({ label, active }: FilterPillBodyProps) {
  const inGlassBar = useInGlassBar();

  if (!inGlassBar) {
    return (
      <View
        accessibilityRole="button"
        className="h-9 flex-row items-center gap-1 self-start rounded-full border border-border bg-surface px-3"
      >
        <Text className="text-xs font-medium text-foreground">{label}</Text>
        <ChevronDown size={12} color={theme.colors.muted} />
      </View>
    );
  }

  // Sur une capsule teintee, le contenu passe en blanc pour rester lisible.
  const contentColor = active ? theme.colors.primaryForeground : theme.colors.foreground;

  return (
    <GlassCapsule active={active} interactive>
      <View accessibilityRole="button" className="h-11 flex-row items-center gap-1 px-4">
        <Text className="text-sm font-medium" style={{ color: contentColor }}>
          {label}
        </Text>
        <ChevronDown size={14} color={active ? theme.colors.primaryForeground : theme.colors.muted} />
      </View>
    </GlassCapsule>
  );
}

interface FilterPillProps {
  label: string;
  onPress: () => void;
}

/** A single-choice filter chip that opens a picker (modal, date picker...)
 * on tap. Pour un choix dans une liste de valeurs, prendre `SelectFilterPill` :
 * il ouvre un menu natif ancre plutot qu'un ecran separe. */
export function FilterPill({ label, onPress }: FilterPillProps) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={8} className="self-start">
      <FilterPillBody label={label} />
    </Pressable>
  );
}

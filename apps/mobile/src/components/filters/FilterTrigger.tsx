import { SlidersHorizontal } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { GlassCapsule } from "../ui/GlassCapsule";
import { useInGlassBar } from "../ui/GlassBar";
import { theme } from "../../theme";

interface FilterTriggerProps {
  activeCount: number;
  onPress: () => void;
}

/** Opens a page's filter bottom sheet, with an active-filter count badge —
 * the mobile stand-in for web's CollapsibleFilterBar trigger button.
 *
 * Dans une `GlassBar` il devient une capsule de verre a part entiere, teintee du
 * vert du projet des qu'un filtre est actif : l'etat se lit sans compter le badge. */
export function FilterTrigger({ activeCount, onPress }: FilterTriggerProps) {
  const inGlassBar = useInGlassBar();
  const isActive = activeCount > 0;

  // Sur une capsule teintee, le contenu passe en blanc pour rester lisible.
  const contentColor = isActive && inGlassBar ? theme.colors.primaryForeground : theme.colors.foreground;

  const content = (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Filtres"
      className={
        inGlassBar
          ? "h-11 flex-row items-center gap-1.5 px-3.5"
          : "h-11 flex-row items-center gap-2 rounded-md border border-border bg-surface px-3"
      }
    >
      <SlidersHorizontal size={theme.iconSize.md} color={contentColor} />
      {/* Dans la barre, la place est comptee : l'icone seule suffit, le libelle
          reste porte par `accessibilityLabel`. */}
      {inGlassBar ? null : (
        <Text className="text-sm font-medium" style={{ color: contentColor }}>
          Filtres
        </Text>
      )}
      {isActive ? (
        <View
          className="h-5 min-w-[20px] items-center justify-center rounded-full px-1"
          style={{
            backgroundColor:
              isActive && inGlassBar ? theme.colors.primaryForeground : theme.colors.primary,
          }}
        >
          <Text
            className="text-[10px] font-semibold"
            style={{
              color: isActive && inGlassBar ? theme.colors.primary : theme.colors.primaryForeground,
            }}
          >
            {activeCount}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );

  if (!inGlassBar) {
    return content;
  }

  return (
    <GlassCapsule active={isActive} interactive>
      {content}
    </GlassCapsule>
  );
}

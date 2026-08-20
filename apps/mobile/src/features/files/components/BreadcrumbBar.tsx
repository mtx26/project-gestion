import { ChevronRight } from "lucide-react-native";
import { Fragment } from "react";
import { Pressable, ScrollView, Text } from "react-native";
import { theme } from "../../../theme";
import type { BreadcrumbEntry } from "../lib/tree-navigation";

interface BreadcrumbBarProps {
  path: BreadcrumbEntry[];
  onNavigate: (folderId: number | null) => void;
}

/** Fil d'Ariane du dossier ouvert : chaque segment ramene a son niveau. Il defile
 * horizontalement, un chemin profond ne devant jamais tronquer le dossier courant. */
export function BreadcrumbBar({ path, onNavigate }: BreadcrumbBarProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ alignItems: "center", gap: 2 }}
    >
      {path.map((entry, index) => {
        const isLast = index === path.length - 1;
        return (
          <Fragment key={entry.id ?? "root"}>
            {index > 0 ? <ChevronRight size={14} color={theme.colors.muted} /> : null}
            <Pressable
              onPress={() => (isLast ? undefined : onNavigate(entry.id))}
              disabled={isLast}
              accessibilityRole="button"
              accessibilityLabel={`Aller a ${entry.name}`}
              className="h-9 justify-center px-1"
            >
              <Text
                className={`text-sm ${isLast ? "font-semibold text-foreground" : "text-primary"}`}
                numberOfLines={1}
              >
                {entry.name}
              </Text>
            </Pressable>
          </Fragment>
        );
      })}
    </ScrollView>
  );
}

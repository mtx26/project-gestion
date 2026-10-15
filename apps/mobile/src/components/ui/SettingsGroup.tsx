import { ChevronRight } from "lucide-react-native";
import type { ComponentType, ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { theme, useThemeColors } from "../../theme";

interface SettingsGroupProps {
  label: string;
  children: ReactNode;
}

/** Un groupe de reglages : un intitule, puis des lignes dans un meme cadre.
 *
 * Toutes les sections d'un ecran de reglages passent par ici. C'est ce qui
 * manquait : l'ecran melangeait des lignes qui poussent un sous-ecran et des
 * cartes affichees en ligne, sans qu'aucun indice ne permette de deviner
 * lesquelles s'ouvrent. */
export function SettingsGroup({ label, children }: SettingsGroupProps) {
  return (
    <View className="gap-2">
      <Text className="text-[11px] font-medium uppercase text-muted">{label}</Text>
      <View className="overflow-hidden rounded-md border border-border bg-surface">{children}</View>
    </View>
  );
}

interface SettingsRowProps {
  icon?: ComponentType<{ size?: number; color?: string }>;
  label: string;
  /** Valeur affichee a droite (nom du projet, nombre de membres...). */
  value?: string;
  /** Controle place a droite — un interrupteur, par exemple. Remplace `value`. */
  trailing?: ReactNode;
  /** Absent = ligne d'information, sans chevron ni retour au toucher. */
  onPress?: () => void;
  /** Action irreversible : la ligne passe en rouge. */
  destructive?: boolean;
  /** Contenu libre sous la ligne (puces de permissions, explication...). */
  children?: ReactNode;
  isLast?: boolean;
  disabled?: boolean;
}

export function SettingsRow({
  icon: Icon,
  label,
  value,
  trailing,
  onPress,
  destructive,
  children,
  isLast,
  disabled,
}: SettingsRowProps) {
  const colors = useThemeColors();
  const accent = destructive ? colors.danger : colors.muted;

  const body = (
    <View className={`px-4 py-3 ${isLast ? "" : "border-b border-border"}`}>
      <View className="min-h-[44px] flex-row items-center gap-3">
        {Icon ? <Icon size={theme.iconSize.sm} color={accent} /> : null}
        <Text className={`flex-1 text-base ${destructive ? "text-danger" : "text-foreground"}`}>
          {label}
        </Text>
        {trailing ?? null}
        {!trailing && value ? (
          <Text className="text-sm text-muted" numberOfLines={1}>
            {value}
          </Text>
        ) : null}
        {onPress ? <ChevronRight size={theme.iconSize.sm} color={colors.muted} /> : null}
      </View>
      {children ? <View className="mt-2">{children}</View> : null}
    </View>
  );

  if (!onPress) {
    return body;
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      android_ripple={{ color: `${colors.foreground}1f` }}
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      {body}
    </Pressable>
  );
}

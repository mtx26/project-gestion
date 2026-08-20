import { FileText, Image as ImageIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { formatBytes } from "@project-gestion/domain";
import { theme } from "../../theme";

interface DocumentRowProps {
  name: string;
  mimeType?: string | null;
  size?: number | null;
  /** Rend la ligne pressable (ouverture du document) — sinon elle est inerte. */
  onPress?: () => void;
  /** La ligne est enveloppee d'un menu d'actions au long press — sert l'indice
   * d'accessibilite, le long press lui-meme est gere par le menu. */
  hasActions?: boolean;
  pending?: boolean;
  trailing?: ReactNode;
}

/** Une piece jointe : icone selon le type, nom, taille — partagee par le champ de
 * saisie (avec un bouton retirer) et les listes en lecture seule (ouverture au tap). */
export function DocumentRow({ name, mimeType, size, onPress, hasActions, pending, trailing }: DocumentRowProps) {
  const Icon = mimeType?.startsWith("image/") ? ImageIcon : FileText;
  const sizeLabel = formatBytes(size);

  const content = (
    <>
      {pending ? (
        <ActivityIndicator size="small" color={theme.colors.primary} />
      ) : (
        <Icon size={theme.iconSize.sm} color={theme.colors.muted} />
      )}
      <View className="flex-1">
        <Text className="text-sm text-foreground" numberOfLines={1}>
          {name}
        </Text>
        {sizeLabel ? <Text className="text-xs text-muted">{sizeLabel}</Text> : null}
      </View>
      {trailing}
    </>
  );

  if (!onPress) {
    return (
      <View className="min-h-[44px] flex-row items-center gap-3 rounded-md border border-border bg-surface px-3 py-2">
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Ouvrir ${name}`}
      accessibilityHint={hasActions ? "Appui long pour les actions" : undefined}
      android_ripple={{ color: `${theme.colors.foreground}1f` }}
      className="min-h-[44px] flex-row items-center gap-3 rounded-md border border-border bg-surface px-3 py-2"
    >
      {content}
    </Pressable>
  );
}

import type { ProjectMember } from "@project-gestion/types";
import { Pressable, Text, View } from "react-native";
import { MemberAvatar } from "../../../components/ui/MemberAvatar";
import { formatMoney } from "../../../lib/money-format";
import { theme } from "../../../theme";
import { OWNER_MEMBER_ID } from "../hooks/use-project-members";

interface MemberCardProps {
  member: ProjectMember;
  /** Aucune action disponible : la carte n'est alors pas pressable. Le long press
   * lui-meme est gere par le `SelectMenu` qui l'enveloppe. */
  hasActions: boolean;
}

/** Un membre du projet : role, taux horaire, et le signalement d'un role supprime
 * (le membre garde sa place mais n'a plus aucune permission). */
export function MemberCard({ member, hasActions }: MemberCardProps) {
  const isOwner = member.id === OWNER_MEMBER_ID;

  return (
    <Pressable
      accessibilityRole={hasActions ? "button" : undefined}
      accessibilityHint={hasActions ? "Appui long pour les actions" : undefined}
      android_ripple={hasActions ? { color: `${theme.colors.foreground}1f` } : undefined}
      className={`flex-row items-center gap-3 rounded-md border p-4 ${
        member.role_deleted ? "border-danger/40 bg-danger/5" : "border-border bg-surface"
      }`}
    >
      <MemberAvatar name={member.user_display_name} pictureUrl={member.user_picture_url} size={36} />
      <View className="flex-1 gap-0.5">
        <Text className="text-base font-medium text-foreground" numberOfLines={1}>
          {member.user_display_name}
        </Text>
        <Text className="text-xs text-muted" numberOfLines={1}>
          {isOwner
            ? "Proprietaire"
            : member.role_deleted
              ? "Aucun role actif"
              : (member.role_name ?? "Sans role")}
          {" · "}
          {formatMoney(member.hourly_rate)}/h
        </Text>
      </View>
    </Pressable>
  );
}

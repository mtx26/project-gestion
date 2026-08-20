import { formatPermissionCode, isProjectOwner, permissionCodes } from "@project-gestion/permissions";
import type { Project } from "@project-gestion/types";
import { useRouter } from "expo-router";
import { AlertTriangle, ChevronRight, Settings, Shield, Users } from "lucide-react-native";
import type { ComponentType } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { ProjectSectionScreen } from "../../../components/layout/ProjectSectionScreen";
import { Button } from "../../../components/ui/Button";
import { getErrorMessage } from "../../../lib/errors";
import { theme } from "../../../theme";
import { useAuthStore } from "../../../stores/auth-store";
import { useProjectPermissions } from "../../projects/hooks/use-project-permissions";
import { useDeleteProject } from "../../projects/hooks/use-projects";
import { useProjectMembers } from "../../projects/hooks/use-project-resources";
import { useProjectRoles } from "../hooks/use-project-roles";

export function ProjectSettingsScreen() {
  return (
    <ProjectSectionScreen title="Parametres projet">
      {(project) => <ProjectSettingsMenu project={project} />}
    </ProjectSectionScreen>
  );
}

/** Menu des parametres du projet : chaque domaine ouvre son propre ecran (comme des
 * reglages systeme), tandis que l'acces et la zone sensible — courts et en lecture
 * seule ou a action unique — restent ici. */
function ProjectSettingsMenu({ project }: { project: Project }) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { can } = useProjectPermissions(project, user?.id ?? null);
  const canViewMembers = can(permissionCodes.memberView);
  const canViewRoles = can(permissionCodes.roleView);
  const isOwner = isProjectOwner(project, user?.id ?? null);

  const { members } = useProjectMembers(canViewMembers ? project.id : null);
  const { roles } = useProjectRoles(project.id, canViewRoles);
  const deleteProject = useDeleteProject();

  function confirmDelete() {
    Alert.alert(
      `Supprimer "${project.name}" ?`,
      "Le projet et tout son contenu partent a la corbeille.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () => deleteProject.mutate(project.id),
        },
      ],
    );
  }

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, gap: 20 }}>
      <View className="gap-2">
        <SectionLabel>Projet</SectionLabel>
        <View className="overflow-hidden rounded-md border border-border bg-surface">
          <MenuRow
            icon={Settings}
            label="General"
            value={project.name}
            onPress={() => router.push("/settings/general")}
          />
          {canViewMembers ? (
            <MenuRow
              icon={Users}
              label="Membres"
              value={String(members.length)}
              onPress={() => router.push("/settings/members")}
            />
          ) : null}
          {canViewRoles ? (
            <MenuRow
              icon={Shield}
              label="Roles"
              value={String(roles.length)}
              onPress={() => router.push("/settings/roles")}
              isLast
            />
          ) : null}
        </View>
      </View>

      <View className="gap-2">
        <SectionLabel>Acces</SectionLabel>
        <View className="gap-3 rounded-md border border-border bg-surface p-4">
          <Text className="text-sm font-medium text-foreground">
            {isOwner ? "Tu es proprietaire de ce projet" : "Projet partage avec toi"}
          </Text>
          <Text className="text-xs text-muted">
            {isOwner
              ? "Tu as acces a toutes les actions du projet."
              : `Partage par ${project.owner_display_name}`}
          </Text>
          <View className="flex-row flex-wrap gap-1.5">
            {isOwner ? (
              <PermissionChip label="Toutes les permissions" />
            ) : project.current_user_permission_codes.length > 0 ? (
              project.current_user_permission_codes.map((code) => (
                <PermissionChip key={code} label={formatPermissionCode(code)} />
              ))
            ) : (
              <Text className="text-xs text-muted">Aucune permission de role.</Text>
            )}
          </View>
        </View>
      </View>

      {isOwner ? (
        <View className="gap-2">
          <SectionLabel>Zone sensible</SectionLabel>
          <View className="gap-3 rounded-md border border-danger/30 bg-danger/5 p-4">
            <View className="flex-row items-center gap-2">
              <AlertTriangle size={theme.iconSize.sm} color={theme.colors.danger} />
              <Text className="text-sm font-medium text-danger">Supprimer le projet</Text>
            </View>
            <Text className="text-xs text-muted">
              Seul le proprietaire peut supprimer {project.name}.
            </Text>
            <Button variant="danger" onPress={confirmDelete} disabled={deleteProject.isPending}>
              {deleteProject.isPending ? "Suppression..." : "Supprimer le projet"}
            </Button>
            {deleteProject.error ? <ErrorState message={getErrorMessage(deleteProject.error)} /> : null}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <Text className="text-[11px] font-medium uppercase text-muted">{children}</Text>;
}

function PermissionChip({ label }: { label: string }) {
  return (
    <View className="rounded-full bg-background px-2.5 py-1">
      <Text className="text-[11px] text-muted">{label}</Text>
    </View>
  );
}

function MenuRow({
  icon: Icon,
  label,
  value,
  onPress,
  isLast,
}: {
  icon: ComponentType<{ size?: number; color?: string }>;
  label: string;
  value?: string;
  onPress: () => void;
  isLast?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      android_ripple={{ color: `${theme.colors.foreground}1f` }}
      className={`min-h-[52px] flex-row items-center gap-3 px-4 py-3 ${isLast ? "" : "border-b border-border"}`}
    >
      <Icon size={theme.iconSize.sm} color={theme.colors.muted} />
      <Text className="flex-1 text-base text-foreground">{label}</Text>
      {value ? (
        <Text className="text-sm text-muted" numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      <ChevronRight size={theme.iconSize.sm} color={theme.colors.muted} />
    </Pressable>
  );
}

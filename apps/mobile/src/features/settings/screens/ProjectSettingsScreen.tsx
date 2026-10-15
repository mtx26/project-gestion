import { formatPermissionCode, isProjectOwner, permissionCodes } from "@project-gestion/permissions";
import type { Project } from "@project-gestion/types";
import { useRouter } from "expo-router";
import { AlertTriangle, KeyRound, Settings, Shield, Users } from "lucide-react-native";
import { Alert, ScrollView, Text, View } from "react-native";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { ProjectSectionScreen } from "../../../components/layout/ProjectSectionScreen";
import { SettingsGroup, SettingsRow } from "../../../components/ui/SettingsGroup";
import { getErrorMessage } from "../../../lib/errors";
import { useAuthStore } from "../../../stores/auth-store";
import { useProjectPermissions } from "../../projects/hooks/use-project-permissions";
import { useDeleteProject } from "../../projects/hooks/use-projects";
import { useProjectMembers } from "../../projects/hooks/use-project-resources";
import { useProjectRoles } from "../../roles/hooks/use-project-roles";

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
      {/* L'identite du projet ouvre la page au lieu d'etre la valeur d'une ligne
          « General » : c'est le sujet de l'ecran, pas un reglage parmi d'autres. */}
      <View className="gap-1">
        <Text className="text-2xl font-semibold text-foreground" numberOfLines={2}>
          {project.name}
        </Text>
        <Text className="text-sm text-muted">
          {isOwner ? "Tu es proprietaire" : `Partage par ${project.owner_display_name}`}
        </Text>
      </View>

      <SettingsGroup label="Configuration">
        <SettingsRow
          icon={Settings}
          label="General"
          value="Nom, description"
          onPress={() => router.push("/settings/general")}
        />
        {canViewMembers ? (
          <SettingsRow
            icon={Users}
            label="Membres"
            value={`${members.length} membre${members.length > 1 ? "s" : ""}`}
            onPress={() => router.push("/settings/members")}
          />
        ) : null}
        {canViewRoles ? (
          <SettingsRow
            icon={Shield}
            label="Roles"
            value={`${roles.length} role${roles.length > 1 ? "s" : ""}`}
            onPress={() => router.push("/settings/roles")}
            isLast
          />
        ) : null}
      </SettingsGroup>

      {/* « Mes permissions » et non « Acces » : la section decrit ce que
          l'utilisateur courant a le droit de faire, pas un reglage du projet. */}
      <SettingsGroup label="Mes permissions">
        <SettingsRow
          icon={KeyRound}
          label={isOwner ? "Toutes les permissions" : "Permissions du role"}
          value={isOwner ? undefined : String(project.current_user_permission_codes.length)}
          isLast
        >
          {isOwner ? null : project.current_user_permission_codes.length > 0 ? (
            <View className="flex-row flex-wrap gap-1.5">
              {project.current_user_permission_codes.map((code) => (
                <PermissionChip key={code} label={formatPermissionCode(code)} />
              ))}
            </View>
          ) : (
            <Text className="text-xs text-muted">Aucune permission de role.</Text>
          )}
        </SettingsRow>
      </SettingsGroup>

      {isOwner ? (
        <SettingsGroup label="Zone sensible">
          <SettingsRow
            icon={AlertTriangle}
            label={deleteProject.isPending ? "Suppression..." : "Supprimer le projet"}
            onPress={confirmDelete}
            destructive
            disabled={deleteProject.isPending}
            isLast
          >
            <Text className="text-xs text-muted">
              Le projet et tout son contenu partent a la corbeille.
            </Text>
            {deleteProject.error ? (
              <View className="mt-2">
                <ErrorState message={getErrorMessage(deleteProject.error)} />
              </View>
            ) : null}
          </SettingsRow>
        </SettingsGroup>
      ) : null}
    </ScrollView>
  );
}

function PermissionChip({ label }: { label: string }) {
  return (
    <View className="rounded-full bg-background px-2.5 py-1">
      <Text className="text-[11px] text-muted">{label}</Text>
    </View>
  );
}

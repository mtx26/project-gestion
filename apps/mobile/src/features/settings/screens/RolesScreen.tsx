import { getPermissionAction, permissionCodes } from "@project-gestion/permissions";
import type { Role } from "@project-gestion/types";
import { Stack, useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyState } from "../../../components/feedback/EmptyState";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { InlineMessage } from "../../../components/ui/InlineMessage";
import { getErrorMessage } from "../../../lib/errors";
import { longPressFeedback } from "../../../lib/haptics";
import { useActionSheet } from "../../../providers/ActionSheetProvider";
import { theme } from "../../../theme";
import { useAuthStore } from "../../../stores/auth-store";
import { useProjectPermissions } from "../../projects/hooks/use-project-permissions";
import { useSelectedProject } from "../../projects/hooks/use-selected-project";
import { useDeleteRole, usePermissions, useProjectRoles } from "../hooks/use-project-roles";

const VISIBLE_PERMISSIONS = 6;

export function RolesScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const showActionSheet = useActionSheet();
  const { selectedProject, isLoading } = useSelectedProject();
  const projectId = selectedProject?.id ?? null;
  const { can } = useProjectPermissions(selectedProject, user?.id ?? null);
  const canManageRoles = can(permissionCodes.roleEdit);
  const canDeleteRoles = can(permissionCodes.roleDelete);

  const { roles, isLoading: isLoadingRoles } = useProjectRoles(projectId);
  const { permissions } = usePermissions(canManageRoles);
  const deleteRole = useDeleteRole(projectId);

  function openRoleActions(role: Role) {
    const options = [
      ...(canManageRoles ? [{ label: "Modifier", value: "edit" }] : []),
      ...(canDeleteRoles ? [{ label: "Supprimer", value: "delete", destructive: true }] : []),
    ];
    if (options.length === 0) {
      return;
    }

    longPressFeedback();
    showActionSheet(role.name, options, (value) => {
      if (value === "edit") {
        router.push({ pathname: "/settings/roles/[id]/edit", params: { id: String(role.id) } });
      } else {
        Alert.alert(
          `Supprimer le role "${role.name}" ?`,
          "Les membres ayant ce role perdront immediatement les permissions associees.",
          [
            { text: "Annuler", style: "cancel" },
            { text: "Supprimer", style: "destructive", onPress: () => deleteRole.mutate(role.id) },
          ],
        );
      }
    });
  }

  return (
    // No "top" edge: the native header already sits above this screen.
    <SafeAreaView className="flex-1 bg-background" edges={["bottom", "left", "right"]}>
      <Stack.Screen options={{ title: "Roles" }} />

      {isLoading || isLoadingRoles ? (
        <LoadingState />
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, gap: 12 }}>
          {canManageRoles && permissions.length === 0 ? (
            <InlineMessage>
              Aucune permission disponible : lance les migrations backend pour les initialiser avant de
              creer des roles.
            </InlineMessage>
          ) : null}

          {canManageRoles && permissions.length > 0 ? (
            <Pressable
              onPress={() => router.push("/settings/roles/create")}
              accessibilityRole="button"
              android_ripple={{ color: `${theme.colors.primaryForeground}33` }}
              className="h-11 flex-row items-center justify-center gap-2 rounded-md bg-primary"
            >
              <Plus size={theme.iconSize.sm} color={theme.colors.primaryForeground} />
              <Text className="text-sm font-semibold text-primaryForeground">Nouveau role</Text>
            </Pressable>
          ) : null}

          {deleteRole.error ? <ErrorState message={getErrorMessage(deleteRole.error)} /> : null}

          {roles.length === 0 ? (
            <EmptyState
              title="Aucun role"
              description="Cree un role pour donner des permissions aux membres du projet."
            />
          ) : (
            roles.map((role) => (
              <RoleCard key={role.id} role={role} onLongPress={() => openRoleActions(role)} />
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function RoleCard({ role, onLongPress }: { role: Role; onLongPress: () => void }) {
  const hasPermissions = role.permissions.length > 0;

  return (
    <Pressable
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityHint="Appui long pour les actions"
      android_ripple={{ color: `${theme.colors.foreground}1f` }}
      className="gap-2 rounded-md border border-border bg-surface p-4"
    >
      <View className="flex-row items-center justify-between gap-2">
        <Text className="flex-1 text-base font-medium text-foreground" numberOfLines={1}>
          {role.name}
        </Text>
        <Text className={`text-xs ${hasPermissions ? "text-muted" : "text-danger"}`}>
          {hasPermissions ? `${role.permissions.length} permissions` : "Aucune permission"}
        </Text>
      </View>

      {hasPermissions ? (
        <View className="flex-row flex-wrap gap-1.5">
          {role.permissions.slice(0, VISIBLE_PERMISSIONS).map((permission) => (
            <View key={permission.id} className="rounded-full bg-background px-2.5 py-1">
              <Text className="text-[11px] text-muted">{getPermissionAction(permission.code)}</Text>
            </View>
          ))}
          {role.permissions.length > VISIBLE_PERMISSIONS ? (
            <View className="rounded-full bg-background px-2.5 py-1">
              <Text className="text-[11px] text-muted">
                +{role.permissions.length - VISIBLE_PERMISSIONS}
              </Text>
            </View>
          ) : null}
        </View>
      ) : (
        <Text className="text-xs text-muted">
          Role incomplet : ajoute des permissions avant utilisation.
        </Text>
      )}
    </Pressable>
  );
}

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
import { SelectMenu, type SelectMenuOption } from "../../../components/menus/SelectMenu";
import { GlassFab, GLASS_FAB_CLEARANCE } from "../../../components/ui/GlassFab";
import { theme } from "../../../theme";
import { useAuthStore } from "../../../stores/auth-store";
import { useProjectPermissions } from "../../projects/hooks/use-project-permissions";
import { useSelectedProject } from "../../projects/hooks/use-selected-project";
import { useDeleteRole, usePermissions, useProjectRoles } from "../hooks/use-project-roles";

const VISIBLE_PERMISSIONS = 6;

export function RolesScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { selectedProject, isLoading } = useSelectedProject();
  const projectId = selectedProject?.id ?? null;
  const { can } = useProjectPermissions(selectedProject, user?.id ?? null);
  const canManageRoles = can(permissionCodes.roleEdit);
  const canDeleteRoles = can(permissionCodes.roleDelete);

  const { roles, isLoading: isLoadingRoles } = useProjectRoles(projectId);
  const { permissions } = usePermissions(canManageRoles);
  const deleteRole = useDeleteRole(projectId);

  function roleActions(role: Role): SelectMenuOption[] {
    return [
      ...(canManageRoles ? [{ label: "Modifier", value: "edit" }] : []),
      ...(canDeleteRoles ? [{ label: "Supprimer", value: "delete", destructive: true }] : []),
    ];
  }

  function runRoleAction(role: Role, value: string) {
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
  }

  return (
    // No "top" edge: the native header already sits above this screen.
    <SafeAreaView className="flex-1 bg-background" edges={["bottom", "left", "right"]}>
      <Stack.Screen options={{ title: "Roles" }} />

      {isLoading || isLoadingRoles ? (
        <LoadingState />
      ) : (
        <ScrollView
          className="flex-1"
          // Place reservee au bouton flottant, comme sur les autres ecrans de liste.
          contentContainerStyle={{
            padding: 20,
            gap: 12,
            paddingBottom: canManageRoles && permissions.length > 0 ? GLASS_FAB_CLEARANCE : 20,
          }}
        >
          {canManageRoles && permissions.length === 0 ? (
            <InlineMessage>
              Aucune permission disponible : lance les migrations backend pour les initialiser avant de
              creer des roles.
            </InlineMessage>
          ) : null}

          {deleteRole.error ? <ErrorState message={getErrorMessage(deleteRole.error)} /> : null}

          {roles.length === 0 ? (
            <EmptyState
              title="Aucun role"
              description="Cree un role pour donner des permissions aux membres du projet."
            />
          ) : (
            roles.map((role) => {
              const actions = roleActions(role);
              return actions.length === 0 ? (
                <View key={role.id}>
                  <RoleCard role={role} hasActions={false} />
                </View>
              ) : (
                <SelectMenu
                  key={role.id}
                  title={role.name}
                  options={actions}
                  onSelect={(value) => runRoleAction(role, value)}
                  shouldOpenOnLongPress
                  onOpenMenu={longPressFeedback}
                >
                  <RoleCard role={role} hasActions />
                </SelectMenu>
              );
            })
          )}
        </ScrollView>
      )}

      {canManageRoles && permissions.length > 0 ? (
        <GlassFab
          icon={Plus}
          label="Nouveau role"
          onPress={() => router.push("/settings/roles/create")}
        />
      ) : null}
    </SafeAreaView>
  );
}

function RoleCard({ role, hasActions }: { role: Role; hasActions: boolean }) {
  const hasPermissions = role.permissions.length > 0;

  return (
    <Pressable
      accessibilityRole={hasActions ? "button" : undefined}
      accessibilityHint={hasActions ? "Appui long pour les actions" : undefined}
      android_ripple={hasActions ? { color: `${theme.colors.foreground}1f` } : undefined}
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

import {
  buildRolePayload,
  canCreateRoleDraft,
  getPermissionAction,
  groupPermissionsByScope,
  normalizePermissionIds,
  removePermissionIdWithDependents,
} from "@project-gestion/permissions";
import type { Permission } from "@project-gestion/types";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { FormScreen } from "../../../components/layout/FormScreen";
import { FormField } from "../../../components/ui/FormField";
import { InlineMessage } from "../../../components/ui/InlineMessage";
import { getErrorMessage } from "../../../lib/errors";
import { theme } from "../../../theme";
import { useSelectedProject } from "../../projects/hooks/use-selected-project";
import { useCreateRole, usePermissions, useProjectRoles, useUpdateRole } from "../hooks/use-project-roles";

interface RoleFormScreenProps {
  mode: "create" | "edit";
  roleId?: number;
}

export function RoleFormScreen({ mode, roleId }: RoleFormScreenProps) {
  const { selectedProject } = useSelectedProject();
  const projectId = selectedProject?.id ?? null;
  const { roles, isLoading: isLoadingRoles } = useProjectRoles(projectId);
  const { permissions, isLoading: isLoadingPermissions } = usePermissions();

  const role = mode === "edit" ? roles.find((item) => item.id === roleId) : undefined;

  if (isLoadingPermissions || (mode === "edit" && (isLoadingRoles || !role))) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <LoadingState />
      </SafeAreaView>
    );
  }

  return (
    <RoleFormBody
      mode={mode}
      projectId={projectId}
      permissions={permissions}
      initialName={role?.name ?? ""}
      initialPermissionIds={
        role ? normalizePermissionIds(permissions, role.permissions.map((permission) => permission.id)) : []
      }
      roleId={role?.id}
    />
  );
}

function RoleFormBody({
  mode,
  projectId,
  roleId,
  permissions,
  initialName,
  initialPermissionIds,
}: {
  mode: "create" | "edit";
  projectId: number | null;
  roleId?: number;
  permissions: Permission[];
  initialName: string;
  initialPermissionIds: number[];
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [permissionIds, setPermissionIds] = useState<number[]>(initialPermissionIds);
  const [rawError, setRawError] = useState<unknown>(null);

  const createRole = useCreateRole(projectId);
  const updateRole = useUpdateRole(projectId);

  const groups = groupPermissionsByScope(permissions);
  const canSubmit = canCreateRoleDraft(name, permissionIds);
  const isPending = createRole.isPending || updateRole.isPending;

  // Les actions dependent de la lecture : cocher une action ajoute automatiquement les
  // droits necessaires, decocher une lecture retire ce qui en depend. Toute cette regle
  // vit dans `@project-gestion/permissions`, partagee avec le web.
  function togglePermission(permissionId: number, enabled: boolean) {
    setPermissionIds((current) =>
      enabled
        ? normalizePermissionIds(permissions, [...current, permissionId])
        : removePermissionIdWithDependents(permissions, current, permissionId),
    );
  }

  function toggleGroup(groupIds: number[], enabled: boolean) {
    setPermissionIds((current) =>
      enabled
        ? normalizePermissionIds(permissions, [...new Set([...current, ...groupIds])])
        : groupIds.reduce(
            (nextIds, groupId) => removePermissionIdWithDependents(permissions, nextIds, groupId),
            current,
          ),
    );
  }

  async function onSubmit() {
    if (!canSubmit || !projectId) {
      return;
    }
    setRawError(null);
    const payload = buildRolePayload(name, normalizePermissionIds(permissions, permissionIds));
    try {
      if (mode === "create") {
        await createRole.mutateAsync(payload);
      } else if (roleId != null) {
        await updateRole.mutateAsync({ roleId, payload });
      }
      router.back();
    } catch (caught) {
      setRawError(caught);
    }
  }

  return (
    <FormScreen
      title={mode === "create" ? "Nouveau role" : "Modifier le role"}
      submitLabel={mode === "create" ? "Creer" : "Enregistrer"}
      submitDisabled={!canSubmit || isPending}
      onCancel={() => router.back()}
      onSubmit={onSubmit}
    >
      <InlineMessage variant="danger">{getErrorMessage(rawError)}</InlineMessage>

      <FormField
        label="Nom du role"
        value={name}
        onChangeText={setName}
        placeholder="Ex. Contributeur"
        autoCapitalize="sentences"
        returnKeyType="done"
      />

      <View className="gap-1">
        <Text className="text-sm font-medium text-foreground">Permissions</Text>
        <Text className="text-xs text-muted">
          Les actions dependent de la lecture : activer une action ajoute automatiquement les droits
          necessaires.
        </Text>
      </View>

      {groups.map((group) => {
        const groupIds = group.permissions.map((permission) => permission.id);
        const groupFullySelected = groupIds.every((id) => permissionIds.includes(id));

        return (
          <View key={group.scope} className="gap-1 rounded-md border border-border bg-surface p-4">
            <PermissionSwitch
              label={group.label}
              value={groupFullySelected}
              onChange={(enabled) => toggleGroup(groupIds, enabled)}
              emphasized
            />
            {group.permissions.map((permission) => (
              <PermissionSwitch
                key={permission.id}
                label={getPermissionAction(permission.code)}
                value={permissionIds.includes(permission.id)}
                onChange={(enabled) => togglePermission(permission.id, enabled)}
              />
            ))}
          </View>
        );
      })}

      {!canSubmit ? (
        <Text className="text-xs text-muted">Un role doit avoir un nom et au moins une permission.</Text>
      ) : null}
    </FormScreen>
  );
}

function PermissionSwitch({
  label,
  value,
  onChange,
  emphasized,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  emphasized?: boolean;
}) {
  return (
    <View
      className={`min-h-[44px] flex-row items-center justify-between gap-3 ${
        emphasized ? "border-b border-border pb-2" : ""
      }`}
    >
      <Text
        className={`flex-1 ${emphasized ? "text-sm font-semibold text-foreground" : "text-sm text-foreground"}`}
      >
        {label}
      </Text>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ true: theme.colors.primary }}
      />
    </View>
  );
}

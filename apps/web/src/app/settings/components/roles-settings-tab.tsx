"use client";

import type { Permission, Project, Role } from "@project-gestion/types";
import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@project-gestion/query-keys";
import {
  buildRolePayload,
  canCreateRoleDraft,
  getPermissionAction,
  normalizePermissionIds,
} from "@project-gestion/permissions";
import { useMutation, useQuery } from "@tanstack/react-query";
import { normalizeApiList } from "@project-gestion/api";
import { Pencil, Plus, Shield, Trash2 } from "lucide-react";
import { useState } from "react";
import { RoleFormDialog } from "@/app/settings/components/role-form-dialog";
import { FormError } from "@/components/forms/form-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";

export function RolesSettingsTab({
  selectedProject,
  queryClient,
  permissions,
  canManageRoles,
  canDeleteRoles,
}: {
  selectedProject: Project;
  queryClient: QueryClient;
  permissions: Permission[];
  canManageRoles: boolean;
  canDeleteRoles: boolean;
}) {
  const [roleName, setRoleName] = useState("");
  const [rolePermissionIds, setRolePermissionIds] = useState<number[]>([]);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  const rolesQuery = useQuery({
    queryKey: queryKeys.roles.list(selectedProject.id),
    queryFn: () => api.roles.list(selectedProject.id),
  });
  const roles = normalizeApiList(rolesQuery.data);

  const createRole = useMutation({
    mutationFn: () =>
      api.roles.create(
        selectedProject.id,
        buildRolePayload(roleName, normalizePermissionIds(permissions, rolePermissionIds)),
      ),
    onSuccess: async () => {
      toast.success("Role cree");
      resetDialog();
      await queryClient.invalidateQueries({ queryKey: queryKeys.roles.list(selectedProject.id) });
    },
  });

  const updateRole = useMutation({
    mutationFn: () =>
      api.roles.update(
        selectedProject.id,
        editingRole!.id,
        buildRolePayload(roleName, normalizePermissionIds(permissions, rolePermissionIds)),
      ),
    onSuccess: async () => {
      toast.success("Role mis a jour");
      resetDialog();
      await queryClient.invalidateQueries({ queryKey: queryKeys.roles.list(selectedProject.id) });
    },
  });

  const deleteRole = useMutation({
    mutationFn: (roleId: number) => api.roles.remove(selectedProject.id, roleId),
    onSuccess: async () => {
      toast.success("Role supprime");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.roles.list(selectedProject.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.members.list(selectedProject.id) }),
      ]);
    },
  });

  function resetDialog() {
    setRoleDialogOpen(false);
    setEditingRole(null);
    setRoleName("");
    setRolePermissionIds([]);
  }

  function openCreateDialog() {
    setEditingRole(null);
    setRoleName("");
    setRolePermissionIds([]);
    setRoleDialogOpen(true);
  }

  function openEditDialog(role: Role) {
    setEditingRole(role);
    setRoleName(role.name);
    setRolePermissionIds(normalizePermissionIds(permissions, role.permissions.map((p) => p.id)));
    setRoleDialogOpen(true);
  }

  function onSubmit() {
    if (!canCreateRoleDraft(roleName, rolePermissionIds)) return;
    if (editingRole) { updateRole.mutate(); return; }
    createRole.mutate();
  }

  return (
    <>
      <Card className="rounded-lg">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Shield className="size-4 text-primary" />
              Roles
            </CardTitle>
            {canManageRoles && permissions.length > 0 ? (
              <Button size="sm" onClick={openCreateDialog}>
                <Plus className="size-4" />
                Nouveau role
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {canManageRoles && permissions.length === 0 ? (
            <div className="rounded-md border border-dashed bg-muted/20 p-4">
              <p className="text-sm font-medium">Aucune permission disponible</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Lance les migrations backend pour initialiser les permissions avant de creer des roles.
              </p>
            </div>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2">
            {roles.map((role) => (
              <div key={role.id} className="rounded-md border bg-muted/30 p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">{role.name}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant={role.permissions.length === 0 ? "destructive" : "secondary"}>
                      {role.permissions.length === 0
                        ? "Aucune permission"
                        : `${role.permissions.length} permission(s)`}
                    </Badge>
                    {canManageRoles ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Modifier ${role.name}`}
                        onClick={() => openEditDialog(role)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                    ) : null}
                    {canDeleteRoles ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Supprimer ${role.name}`}
                        disabled={deleteRole.isPending}
                        onClick={() => deleteRole.mutate(role.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    ) : null}
                  </div>
                </div>
                {role.permissions.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {role.permissions.slice(0, 6).map((permission) => (
                      <Badge key={permission.id} variant="outline">
                        {getPermissionAction(permission.code)}
                      </Badge>
                    ))}
                    {role.permissions.length > 6 ? (
                      <Badge variant="outline">+{role.permissions.length - 6}</Badge>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Role incomplet: ajoute des permissions avant utilisation.
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {canManageRoles && permissions.length > 0 ? (
        <RoleFormDialog
          open={roleDialogOpen}
          onOpenChange={(open) => { if (!open) resetDialog(); else setRoleDialogOpen(true); }}
          mode={editingRole ? "edit" : "create"}
          roleName={roleName}
          onRoleNameChange={setRoleName}
          rolePermissionIds={rolePermissionIds}
          onRolePermissionIdsChange={setRolePermissionIds}
          permissions={permissions}
          onSubmit={onSubmit}
          error={editingRole ? getErrorMessage(updateRole.error) : getErrorMessage(createRole.error)}
          isPending={editingRole ? updateRole.isPending : createRole.isPending}
        />
      ) : null}
      <FormError message={getErrorMessage(deleteRole.error)} />
    </>
  );
}

"use client";

import type { Permission, Project, Role } from "@project-gestion/types";
import { queryKeys } from "@project-gestion/query-keys";
import { getPermissionAction } from "@project-gestion/permissions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { normalizeApiList } from "@project-gestion/api";
import { Pencil, Plus, Shield, Trash2 } from "lucide-react";
import { useState } from "react";
import { RoleFormDialog, type RolePayload } from "@/app/settings/components/role-form-dialog";
import { ConfirmDeleteDialog } from "@/components/dialogs/confirm-delete-dialog";
import { FormError } from "@/components/forms/form-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MutedInfoCard } from "@/components/muted-info-card";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage, toastError } from "@/lib/errors";

export function RolesSettingsTab({
  selectedProject,
  permissions,
  canManageRoles,
  canDeleteRoles,
}: {
  selectedProject: Project;
  permissions: Permission[];
  canManageRoles: boolean;
  canDeleteRoles: boolean;
}) {
  const queryClient = useQueryClient();
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [deletingRole, setDeletingRole] = useState<Role | null>(null);

  const rolesQuery = useQuery({
    queryKey: queryKeys.roles.list(selectedProject.id),
    queryFn: () => api.roles.list(selectedProject.id),
  });
  const roles = normalizeApiList(rolesQuery.data);

  const createRole = useMutation({
    mutationFn: (payload: RolePayload) => api.roles.create(selectedProject.id, payload),
    onSuccess: async () => {
      toast.success("Role cree");
      setRoleDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.roles.list(selectedProject.id) });
    },
    onError: toastError,
  });

  const updateRole = useMutation({
    mutationFn: ({ roleId, payload }: { roleId: number; payload: RolePayload }) =>
      api.roles.update(selectedProject.id, roleId, payload),
    onSuccess: async () => {
      toast.success("Role mis a jour");
      setEditingRole(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.roles.list(selectedProject.id) });
    },
    onError: toastError,
  });

  const deleteRole = useMutation({
    mutationFn: (roleId: number) => api.roles.remove(selectedProject.id, roleId),
    onSuccess: async () => {
      toast.success("Role supprime");
      setDeletingRole(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.roles.list(selectedProject.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.members.list(selectedProject.id) }),
      ]);
    },
    onError: toastError,
  });

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
              <Button size="sm" onClick={() => setRoleDialogOpen(true)}>
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
              <MutedInfoCard key={role.id}>
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
                        onClick={() => setEditingRole(role)}
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
                        onClick={() => setDeletingRole(role)}
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
              </MutedInfoCard>
            ))}
          </div>
        </CardContent>
      </Card>

      {canManageRoles && permissions.length > 0 ? (
        <>
          <RoleFormDialog
            mode="create"
            open={roleDialogOpen}
            permissions={permissions}
            isPending={createRole.isPending}
            error={getErrorMessage(createRole.error)}
            onOpenChange={setRoleDialogOpen}
            onSubmit={(payload) => createRole.mutate(payload)}
          />
          <RoleFormDialog
            key={editingRole?.id ?? "edit-none"}
            mode="edit"
            role={editingRole}
            permissions={permissions}
            isPending={updateRole.isPending}
            error={getErrorMessage(updateRole.error)}
            onOpenChange={(open) => { if (!open) setEditingRole(null); }}
            onSubmit={(payload) => editingRole && updateRole.mutate({ roleId: editingRole.id, payload })}
          />
        </>
      ) : null}
      <FormError message={getErrorMessage(deleteRole.error)} />
      <ConfirmDeleteDialog
        open={deletingRole != null}
        title={`Supprimer le role "${deletingRole?.name}" ?`}
        description="Les membres ayant ce role perdront immediatement les permissions associees."
        isPending={deleteRole.isPending}
        onConfirm={() => deletingRole && deleteRole.mutate(deletingRole.id)}
        onClose={() => setDeletingRole(null)}
      />
    </>
  );
}

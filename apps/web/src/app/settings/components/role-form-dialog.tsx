"use client";

import type { Permission, Role } from "@project-gestion/types";
import { useState } from "react";
import {
  buildRolePayload,
  canCreateRoleDraft,
  getPermissionAction,
  groupPermissionsByScope,
  normalizePermissionIds,
  removePermissionIdWithDependents,
} from "@project-gestion/permissions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogClose } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { FormSubmitButton } from "@/components/forms/form-submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export type RolePayload = ReturnType<typeof buildRolePayload>;

interface RoleFormDialogProps {
  mode: "create" | "edit";
  open?: boolean;
  role?: Role | null;
  permissions: Permission[];
  isPending: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: RolePayload) => void;
}

/** Same create/edit dialog API as the other `<Feature>FormDialog`s: owns its own
 * draft state internally, mount a fresh instance per entity via `key={role?.id}`
 * for edit (see `RolesSettingsTab`). Not RHF-driven like its siblings — the
 * checkbox-tree's cross-dependency logic (`removePermissionIdWithDependents`)
 * operates on a plain `number[]`, which plain `useState` fits more directly. */
export function RoleFormDialog({
  mode,
  open,
  role,
  permissions,
  isPending,
  error,
  onOpenChange,
  onSubmit,
}: RoleFormDialogProps) {
  const isOpen = mode === "create" ? (open ?? false) : role != null;
  const [roleName, setRoleName] = useState(role?.name ?? "");
  const [rolePermissionIds, setRolePermissionIds] = useState<number[]>(
    role ? normalizePermissionIds(permissions, role.permissions.map((p) => p.id)) : [],
  );

  const permissionGroups = groupPermissionsByScope(permissions);
  const allPermissionIds = permissions.map((permission) => permission.id);
  const allSelected =
    allPermissionIds.length > 0 && allPermissionIds.every((id) => rolePermissionIds.includes(id));
  const canSubmit = canCreateRoleDraft(roleName, rolePermissionIds);

  function togglePermission(permissionId: number, checked: boolean) {
    setRolePermissionIds(
      checked
        ? normalizePermissionIds(permissions, [...rolePermissionIds, permissionId])
        : removePermissionIdWithDependents(permissions, rolePermissionIds, permissionId),
    );
  }

  function toggleGroup(groupIds: number[], checked: boolean) {
    setRolePermissionIds(
      checked
        ? normalizePermissionIds(permissions, [...new Set([...rolePermissionIds, ...groupIds])])
        : groupIds.reduce(
            (nextIds, groupId) => removePermissionIdWithDependents(permissions, nextIds, groupId),
            rolePermissionIds,
          ),
    );
  }

  function toggleAll(checked: boolean) {
    setRolePermissionIds(checked ? allPermissionIds : []);
  }

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit(buildRolePayload(roleName, normalizePermissionIds(permissions, rolePermissionIds)));
  }

  return (
    <FormDialog
      open={isOpen}
      onOpenChange={onOpenChange}
      title={mode === "create" ? "Nouveau role" : "Modifier le role"}
      description={
        mode === "create"
          ? "Definis un nom et les permissions associees a ce role."
          : "Mets a jour le nom ou les permissions de ce role."
      }
      error={error}
      footer={
        <>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Annuler
            </Button>
          </DialogClose>
          <FormSubmitButton
            form="role-form"
            pending={isPending}
            disabled={!canSubmit || isPending}
            label={mode === "create" ? "Creer le role" : "Enregistrer"}
            pendingLabel="Enregistrement..."
          />
        </>
      }
    >
        <form
          id="role-form"
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit();
          }}
        >
          <Field>
            <FieldLabel htmlFor="role-name">Nom du role</FieldLabel>
            <Input
              id="role-name"
              placeholder="Ex. Contributeur"
              value={roleName}
              onChange={(event) => setRoleName(event.target.value)}
            />
          </Field>

          <Separator />

          <div className="flex items-center justify-between gap-3">
            <Label>Permissions</Label>
            {permissions.length > 0 ? (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="permissions-select-all"
                  checked={allSelected}
                  onCheckedChange={(checked) => toggleAll(checked === true)}
                />
                <Label htmlFor="permissions-select-all" className="font-normal text-muted-foreground">
                  Tout selectionner
                </Label>
              </div>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            Les actions dependent de la lecture: cocher une action ajoute automatiquement les droits necessaires.
          </p>

          <div className="-mx-4 no-scrollbar max-h-[50vh] overflow-y-auto px-4">
            <div className="space-y-3 py-1">
              {permissionGroups.map((group) => {
                const groupIds = group.permissions.map((permission) => permission.id);
                const groupFullySelected = groupIds.every((id) => rolePermissionIds.includes(id));
                const groupPartiallySelected =
                  !groupFullySelected && groupIds.some((id) => rolePermissionIds.includes(id));

                return (
                  <div key={group.scope} className="rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`permission-group-${group.scope}`}
                        checked={groupPartiallySelected ? "indeterminate" : groupFullySelected}
                        onCheckedChange={(checked) => toggleGroup(groupIds, checked === true)}
                      />
                      <Label htmlFor={`permission-group-${group.scope}`}>{group.label}</Label>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {group.permissions.map((permission) => {
                        const fieldId = `permission-${permission.id}`;
                        return (
                          <div key={permission.id} className="flex items-center gap-2 rounded-md px-1 py-0.5">
                            <Checkbox
                              id={fieldId}
                              checked={rolePermissionIds.includes(permission.id)}
                              onCheckedChange={(checked) => togglePermission(permission.id, checked === true)}
                            />
                            <Label htmlFor={fieldId} className="font-normal">
                              {getPermissionAction(permission.code)}
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {!canSubmit ? (
            <p className="text-xs text-muted-foreground">
              Un role doit avoir un nom et au moins une permission.
            </p>
          ) : null}
        </form>
    </FormDialog>
  );
}

"use client";

import type { Permission } from "@project-gestion/types";
import {
  canCreateRoleDraft,
  getPermissionAction,
  groupPermissionsByScope,
  normalizePermissionIds,
  removePermissionIdWithDependents,
} from "@project-gestion/permissions";
import { Plus, Save } from "lucide-react";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

type RoleFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  roleName: string;
  onRoleNameChange: (name: string) => void;
  rolePermissionIds: number[];
  onRolePermissionIdsChange: (ids: number[]) => void;
  permissions: Permission[];
  onSubmit: () => void;
  error: string | null;
  isPending: boolean;
};

export function RoleFormDialog({
  open,
  onOpenChange,
  mode,
  roleName,
  onRoleNameChange,
  rolePermissionIds,
  onRolePermissionIdsChange,
  permissions,
  onSubmit,
  error,
  isPending,
}: RoleFormDialogProps) {
  const permissionGroups = groupPermissionsByScope(permissions);
  const allPermissionIds = permissions.map((permission) => permission.id);
  const allSelected =
    allPermissionIds.length > 0 && allPermissionIds.every((id) => rolePermissionIds.includes(id));
  const canSubmit = canCreateRoleDraft(roleName, rolePermissionIds);

  function togglePermission(permissionId: number, checked: boolean) {
    onRolePermissionIdsChange(
      checked
        ? normalizePermissionIds(permissions, [...rolePermissionIds, permissionId])
        : removePermissionIdWithDependents(permissions, rolePermissionIds, permissionId),
    );
  }

  function toggleGroup(groupIds: number[], checked: boolean) {
    onRolePermissionIdsChange(
      checked
        ? normalizePermissionIds(permissions, [...new Set([...rolePermissionIds, ...groupIds])])
        : groupIds.reduce(
            (nextIds, groupId) => removePermissionIdWithDependents(permissions, nextIds, groupId),
            rolePermissionIds,
          ),
    );
  }

  function toggleAll(checked: boolean) {
    onRolePermissionIdsChange(checked ? allPermissionIds : []);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Nouveau role" : "Modifier le role"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Definis un nom et les permissions associees a ce role."
              : "Mets a jour le nom ou les permissions de ce role."}
          </DialogDescription>
        </DialogHeader>

        <form
          id="role-form"
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit) onSubmit();
          }}
        >
          <Field>
            <FieldLabel htmlFor="role-name">Nom du role</FieldLabel>
            <Input
              id="role-name"
              placeholder="Ex. Contributeur"
              value={roleName}
              onChange={(event) => onRoleNameChange(event.target.value)}
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

          <FormError message={error} />
        </form>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Annuler
            </Button>
          </DialogClose>
          <Button type="submit" form="role-form" disabled={!canSubmit || isPending}>
            {mode === "create" ? <Plus className="size-4" /> : <Save className="size-4" />}
            {isPending ? "Enregistrement..." : mode === "create" ? "Creer le role" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

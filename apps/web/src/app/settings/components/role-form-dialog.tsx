"use client";

import type { Permission, Role } from "@project-gestion/types";
import { roleNameSchema } from "@project-gestion/validation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
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
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { FormSubmitButton } from "@/components/forms/form-submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export type RolePayload = ReturnType<typeof buildRolePayload>;

const roleFormSchema = z.object({
  name: roleNameSchema,
  permissionIds: z.array(z.number()),
});
type RoleFormValues = z.infer<typeof roleFormSchema>;

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

/** Same create/edit dialog API as the other `<Feature>FormDialog`s: mount a fresh
 * instance per entity via `key={role?.id}` for edit (see `RolesSettingsTab`). The
 * name field is RHF+Zod like every other form field in the app; the permission
 * checkbox-tree is bound via `form.setValue`/`useWatch` rather than `Controller`
 * (same pattern `DateRangeField` uses) because its cross-dependency logic
 * (`removePermissionIdWithDependents`) reads/writes the current `number[]` directly. */
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

  const form = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: {
      name: role?.name ?? "",
      permissionIds: role ? normalizePermissionIds(permissions, role.permissions.map((p) => p.id)) : [],
    },
  });
  const roleName = useWatch({ control: form.control, name: "name" });
  const rolePermissionIds = useWatch({ control: form.control, name: "permissionIds" });

  const permissionGroups = groupPermissionsByScope(permissions);
  const allPermissionIds = permissions.map((permission) => permission.id);
  const allSelected =
    allPermissionIds.length > 0 && allPermissionIds.every((id) => rolePermissionIds.includes(id));
  const canSubmit = canCreateRoleDraft(roleName, rolePermissionIds);

  function togglePermission(permissionId: number, checked: boolean) {
    form.setValue(
      "permissionIds",
      checked
        ? normalizePermissionIds(permissions, [...rolePermissionIds, permissionId])
        : removePermissionIdWithDependents(permissions, rolePermissionIds, permissionId),
    );
  }

  function toggleGroup(groupIds: number[], checked: boolean) {
    form.setValue(
      "permissionIds",
      checked
        ? normalizePermissionIds(permissions, [...new Set([...rolePermissionIds, ...groupIds])])
        : groupIds.reduce(
            (nextIds, groupId) => removePermissionIdWithDependents(permissions, nextIds, groupId),
            rolePermissionIds,
          ),
    );
  }

  function toggleAll(checked: boolean) {
    form.setValue("permissionIds", checked ? allPermissionIds : []);
  }

  function handleSubmit(values: RoleFormValues) {
    if (!canSubmit) return;
    onSubmit(buildRolePayload(values.name, normalizePermissionIds(permissions, values.permissionIds)));
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
          onSubmit={form.handleSubmit(handleSubmit)}
        >
          <Field>
            <FieldLabel htmlFor="role-name">Nom du role</FieldLabel>
            <Input id="role-name" placeholder="Ex. Contributeur" {...form.register("name")} />
            <FieldError errors={[form.formState.errors.name]} />
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

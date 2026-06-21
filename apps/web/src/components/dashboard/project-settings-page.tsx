"use client";

import type { Project, Role } from "@project-gestion/types";
import { projectSchema, type ProjectFormValues } from "@project-gestion/validation";
import { zodResolver } from "@hookform/resolvers/zod";
import { queryKeys } from "@project-gestion/query-keys";
import {
  buildRolePayload,
  canCreateRoleDraft,
  canDeleteProject,
  canEditProject,
  formatPermissionCode,
  getPermissionAction,
  hasProjectPermission,
  normalizePermissionIds,
  permissionCodes,
} from "@project-gestion/permissions";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Pencil, Plus, Save, Shield, Trash2, Users } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { RoleFormDialog } from "@/components/dashboard/role-form-dialog";
import { FormError } from "@/components/form-error";
import { ProjectWorkspaceShell, type ProjectWorkspaceState } from "@/components/dashboard/project-workspace-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { InvitationStatusBadge } from "@/components/ui/invitation-status-badge";
import { MemberTypeBadge } from "@/components/ui/member-type-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";

type SettingsSection = "general" | "members" | "roles" | "access" | "danger";

function normalizeList<T>(data: T[] | { results: T[] } | undefined) {
  if (!data) {
    return [];
  }

  return Array.isArray(data) ? data : data.results;
}

export function ProjectSettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSection = getSettingsSection(searchParams.get("tab"));
  const buildSettingsHref = (projectId: number) => {
    const params = new URLSearchParams();
    params.set("project", String(projectId));
    if (initialSection !== "general") {
      params.set("tab", initialSection);
    }
    return `/settings?${params.toString()}`;
  };

  return (
    <ProjectWorkspaceShell
      activeItem="settings"
      selectedProjectIdFromUrl={searchParams.get("project") ?? ""}
      maxWidthClassName="max-w-none"
      onProjectSelected={(id) => router.push(buildSettingsHref(id))}
      onProjectCreated={(project) => router.push(buildSettingsHref(project.id))}
    >
      {(state) => <ProjectSettingsContent {...state} initialSection={initialSection} />}
    </ProjectWorkspaceShell>
  );
}

function ProjectSettingsContent({
  user,
  projects,
  selectedProject,
  projectsQuery,
  openCreateProject,
  queryClient,
  initialSection,
}: ProjectWorkspaceState & { initialSection: SettingsSection }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState("");
  const [roleName, setRoleName] = useState("");
  const [rolePermissionIds, setRolePermissionIds] = useState<number[]>([]);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const editForm = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: { name: "", description: "" },
  });

  const isSharedProject = Boolean(user && selectedProject && selectedProject.owner !== user.id);
  const canEditSelectedProject = canEditProject(selectedProject, user?.id ?? null);
  const canDeleteSelectedProject = canDeleteProject(selectedProject, user?.id ?? null);
  const canViewMembers = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.memberView);
  const canManageMembers = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.memberEdit);
  const canViewRoles = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.roleView);
  const canManageRoles = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.roleEdit);
  const canDeleteRoles = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.roleDelete);

  const membersQuery = useQuery({
    queryKey: selectedProject ? queryKeys.members.list(selectedProject.id) : ["members", "disabled"],
    queryFn: () => api.members.list(selectedProject!.id),
    enabled: Boolean(selectedProject && canViewMembers),
  });

  const rolesQuery = useQuery({
    queryKey: selectedProject ? queryKeys.roles.list(selectedProject.id) : ["roles", "disabled"],
    queryFn: () => api.roles.list(selectedProject!.id),
    enabled: Boolean(selectedProject && (canManageMembers || canViewRoles)),
  });

  const permissionsQuery = useQuery({
    queryKey: queryKeys.permissions.list(),
    queryFn: api.permissions.list,
    enabled: Boolean(selectedProject && canManageRoles),
  });
  const invitationsQuery = useQuery({
    queryKey: selectedProject ? queryKeys.invitations.all(selectedProject.id) : ["invitations", "disabled"],
    queryFn: () => api.invitations.list(selectedProject!.id),
    enabled: Boolean(selectedProject && canViewMembers),
  });

  const members = normalizeList(membersQuery.data);
  const roles = normalizeList(rolesQuery.data);
  const permissions = normalizeList(permissionsQuery.data);
  const invitations = normalizeList(invitationsQuery.data);
  const visibleSection = getVisibleSettingsSection(
    initialSection,
    canViewMembers,
    canViewRoles,
    canDeleteSelectedProject,
  );

  useEffect(() => {
    editForm.reset({
      name: selectedProject?.name ?? "",
      description: selectedProject?.description ?? "",
    });
  }, [editForm, selectedProject]);

  const updateProject = useMutation({
    mutationFn: ({ id, values }: { id: number; values: ProjectFormValues }) =>
      api.projects.update(id, {
        name: values.name,
        description: values.description?.trim() || null,
      }),
    onSuccess: async () => {
      toast.success("Projet mis a jour");
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });

  const deleteProject = useMutation({
    mutationFn: api.projects.remove,
    onSuccess: async (_data, deletedProjectId) => {
      const nextProject = projects.find((project) => project.id !== deletedProjectId);
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      router.push(nextProject ? `/settings?project=${nextProject.id}` : "/dashboard");
    },
  });

  const inviteMember = useMutation({
    mutationFn: () =>
      api.invitations.create(selectedProject!.id, {
        email: inviteEmail,
        role: Number(inviteRoleId),
      }),
    onSuccess: async () => {
      toast.success("Invitation envoyee");
      setInviteEmail("");
      setInviteRoleId("");
      await queryClient.invalidateQueries({ queryKey: queryKeys.invitations.all(selectedProject!.id) });
    },
  });
  const removeInvitation = useMutation({
    mutationFn: (invitationId: number) => api.invitations.remove(selectedProject!.id, invitationId),
    onSuccess: async () => {
      toast.success("Invitation annulee");
      await queryClient.invalidateQueries({ queryKey: queryKeys.invitations.all(selectedProject!.id) });
    },
  });
  const updateInvitationRole = useMutation({
    mutationFn: ({ invitationId, roleId }: { invitationId: number; roleId: number }) =>
      api.invitations.update(selectedProject!.id, invitationId, { role: roleId }),
    onSuccess: async () => {
      toast.success("Role mis a jour");
      await queryClient.invalidateQueries({ queryKey: queryKeys.invitations.all(selectedProject!.id) });
    },
  });
  const removeMember = useMutation({
    mutationFn: (memberId: number) => api.members.remove(selectedProject!.id, memberId),
    onSuccess: async () => {
      toast.success("Membre retire");
      await queryClient.invalidateQueries({ queryKey: queryKeys.members.list(selectedProject!.id) });
    },
  });
  const updateMemberRole = useMutation({
    mutationFn: ({ memberId, roleId }: { memberId: number; roleId: number }) =>
      api.members.update(selectedProject!.id, memberId, { role: roleId }),
    onSuccess: async () => {
      toast.success("Role mis a jour");
      await queryClient.invalidateQueries({ queryKey: queryKeys.members.list(selectedProject!.id) });
    },
  });

  const createRole = useMutation({
    mutationFn: () =>
      api.roles.create(
        selectedProject!.id,
        buildRolePayload(roleName, normalizePermissionIds(permissions, rolePermissionIds)),
      ),
    onSuccess: async () => {
      toast.success("Role cree");
      resetRoleDialog();
      await queryClient.invalidateQueries({ queryKey: queryKeys.roles.list(selectedProject!.id) });
    },
  });

  const updateRole = useMutation({
    mutationFn: () =>
      api.roles.update(
        selectedProject!.id,
        editingRole!.id,
        buildRolePayload(roleName, normalizePermissionIds(permissions, rolePermissionIds)),
      ),
    onSuccess: async () => {
      toast.success("Role mis a jour");
      resetRoleDialog();
      await queryClient.invalidateQueries({ queryKey: queryKeys.roles.list(selectedProject!.id) });
    },
  });
  const deleteRole = useMutation({
    mutationFn: (roleId: number) => api.roles.remove(selectedProject!.id, roleId),
    onSuccess: async () => {
      toast.success("Role supprime");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.roles.list(selectedProject!.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.members.list(selectedProject!.id) }),
      ]);
    },
  });

  function resetRoleDialog() {
    setRoleDialogOpen(false);
    setEditingRole(null);
    setRoleName("");
    setRolePermissionIds([]);
  }

  function openCreateRoleDialog() {
    setEditingRole(null);
    setRoleName("");
    setRolePermissionIds([]);
    setRoleDialogOpen(true);
  }

  function openEditRoleDialog(role: Role) {
    setEditingRole(role);
    setRoleName(role.name);
    setRolePermissionIds(
      normalizePermissionIds(
        permissions,
        role.permissions.map((permission) => permission.id),
      ),
    );
    setRoleDialogOpen(true);
  }

  function onSubmitRoleDialog() {
    if (!canCreateRoleDraft(roleName, rolePermissionIds)) {
      return;
    }

    if (editingRole) {
      updateRole.mutate();
      return;
    }

    createRole.mutate();
  }

  function onUpdateProject(values: ProjectFormValues) {
    if (!selectedProject || !canEditSelectedProject) {
      return;
    }

    updateProject.mutate({ id: selectedProject.id, values });
  }

  function onSettingsSectionChange(value: string) {
    const nextSection = getSettingsSection(value);

    if (!selectedProject) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set("project", String(selectedProject.id));
    if (nextSection === "general") {
      params.delete("tab");
    } else {
      params.set("tab", nextSection);
    }

    router.replace(`/settings?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="space-y-5">
      <PageTitle />

      {!projectsQuery.isLoading && !selectedProject ? (
        <EmptySettingsState onCreateProject={openCreateProject} />
      ) : null}

      {selectedProject ? (
        <Tabs value={visibleSection} onValueChange={onSettingsSectionChange}>
          <div>
            <TabsList className="h-auto w-max">
              <TabsTrigger value="general" className="min-w-28 flex-none px-3 py-2">
                General
              </TabsTrigger>
              {canViewMembers ? (
                <TabsTrigger value="members" className="min-w-28 flex-none px-3 py-2">
                  Membres
                </TabsTrigger>
              ) : null}
              {canViewRoles ? (
                <TabsTrigger value="roles" className="min-w-28 flex-none px-3 py-2">
                  Roles
                </TabsTrigger>
              ) : null}
              <TabsTrigger value="access" className="min-w-28 flex-none px-3 py-2">
                Acces
              </TabsTrigger>
              {canDeleteSelectedProject ? (
                <TabsTrigger value="danger" className="min-w-32 flex-none px-3 py-2">
                  Zone sensible
                </TabsTrigger>
              ) : null}
            </TabsList>
          </div>

          <TabsContent value="general">
            <GeneralSettingsCard
              form={editForm}
              canEdit={canEditSelectedProject}
              isPending={updateProject.isPending}
              error={updateProject.error ? getErrorMessage(updateProject.error) : null}
              onSubmit={onUpdateProject}
            />
          </TabsContent>

          {canViewMembers ? (
          <TabsContent value="members">
            <Card className="rounded-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="size-4 text-primary" />
                  Membres
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!canViewMembers ? (
                  <Alert>
                    <AlertDescription>Permission member.view requise pour voir les membres.</AlertDescription>
                  </Alert>
                ) : (
                  <>
                    {canManageMembers ? (
                      <form
                        className="grid gap-2 rounded-md border bg-muted/30 p-3 sm:grid-cols-[1fr_180px_auto]"
                        onSubmit={(event) => {
                          event.preventDefault();
                          if (inviteEmail && inviteRoleId) {
                            inviteMember.mutate();
                          }
                        }}
                      >
                        <Input
                          type="email"
                          placeholder="email@exemple.com"
                          value={inviteEmail}
                          onChange={(event) => setInviteEmail(event.target.value)}
                        />
                        <Select value={inviteRoleId} onValueChange={setInviteRoleId}>
                          <SelectTrigger className="w-full bg-background">
                            <SelectValue placeholder="Role" />
                          </SelectTrigger>
                          <SelectContent>
                            {roles.map((role) => (
                              <SelectItem key={role.id} value={String(role.id)}>
                                {role.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button type="submit" disabled={!inviteEmail || !inviteRoleId || inviteMember.isPending}>
                          Inviter
                        </Button>
                        <FormError message={inviteMember.error ? getErrorMessage(inviteMember.error) : null} />
                      </form>
                    ) : null}
                    <p className="text-sm text-muted-foreground">
                      {members.length} membre(s) direct(s), {invitations.length} invitation(s).
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {members.map((member) => (
                        <div
                          key={member.id}
                          className={`rounded-md border p-3 text-sm ${
                            member.role_deleted
                              ? "border-red-200 bg-red-50/70"
                              : "bg-muted/30"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-2.5">
                              <MemberAvatar
                                name={member.user_display_name}
                                pictureUrl={member.user_picture_url}
                              />
                              <div className="min-w-0">
                                <p className="truncate font-medium">{member.user_display_name}</p>
                                {member.user === selectedProject.owner ? null : canManageMembers ? (
                                  <Select
                                    value={member.role_deleted ? undefined : String(member.role)}
                                    onValueChange={(value) =>
                                      updateMemberRole.mutate({
                                        memberId: member.id,
                                        roleId: Number(value),
                                      })
                                    }
                                  >
                                    <SelectTrigger className="mt-2 h-8 w-full bg-background sm:w-48">
                                      <SelectValue placeholder={member.role_deleted ? "Aucun role actif" : "Role"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {roles.map((role) => (
                                        <SelectItem key={role.id} value={String(role.id)}>
                                          {role.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <p className={`mt-1 truncate text-xs ${member.role_deleted ? "text-red-700" : "text-muted-foreground"}`}>
                                    {member.role_deleted ? "Aucun role actif" : member.role_name}
                                  </p>
                                )}
                                {member.role_deleted ? (
                                  <p className="mt-2 text-xs font-medium text-red-700">
                                    Probleme: ce membre n&apos;a plus de role actif.
                                  </p>
                                ) : null}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <MemberTypeBadge
                                isOwner={member.user === selectedProject.owner}
                                roleDeleted={member.role_deleted}
                              />
                              {canManageMembers && member.user !== selectedProject.owner ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Supprimer ${member.user_display_name}`}
                                  disabled={removeMember.isPending}
                                  onClick={() => removeMember.mutate(member.id)}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ))}
                      {invitations.map((invitation) => {
                        return (
                          <div key={`invitation-${invitation.id}`} className="rounded-md border bg-muted/30 p-3 text-sm">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate font-medium">{invitation.email}</p>
                                {canManageMembers ? (
                                  <Select
                                    value={String(invitation.role)}
                                    onValueChange={(value) =>
                                      updateInvitationRole.mutate({
                                        invitationId: invitation.id,
                                        roleId: Number(value),
                                      })
                                    }
                                  >
                                    <SelectTrigger className="mt-2 h-8 w-full bg-background sm:w-48">
                                      <SelectValue placeholder="Role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {roles.map((role) => (
                                        <SelectItem key={role.id} value={String(role.id)}>
                                          {role.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <p className="mt-1 truncate text-xs text-muted-foreground">{invitation.role_name}</p>
                                )}
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <InvitationStatusBadge status={invitation.status} />
                                {canManageMembers ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label={`Annuler l'invitation ${invitation.email}`}
                                    disabled={removeInvitation.isPending}
                                    onClick={() => removeInvitation.mutate(invitation.id)}
                                  >
                                    <Trash2 className="size-4" />
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <FormError message={removeMember.error ? getErrorMessage(removeMember.error) : null} />
                    <FormError message={updateMemberRole.error ? getErrorMessage(updateMemberRole.error) : null} />
                    <FormError message={updateInvitationRole.error ? getErrorMessage(updateInvitationRole.error) : null} />
                    <FormError message={removeInvitation.error ? getErrorMessage(removeInvitation.error) : null} />
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          ) : null}

          {canViewRoles ? (
          <TabsContent value="roles">
            <Card className="rounded-lg">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="size-4 text-primary" />
                    Roles
                  </CardTitle>
                  {canManageRoles && permissions.length > 0 ? (
                    <Button size="sm" onClick={openCreateRoleDialog}>
                      <Plus className="size-4" />
                      Nouveau role
                    </Button>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {!canViewRoles ? (
                  <Alert>
                    <AlertDescription>Permission role.view requise pour voir les roles.</AlertDescription>
                  </Alert>
                ) : (
                  <>
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
                                  onClick={() => openEditRoleDialog(role)}
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
                  </>
                )}
              </CardContent>
            </Card>

            {canManageRoles && permissions.length > 0 ? (
              <RoleFormDialog
                open={roleDialogOpen}
                onOpenChange={(open) => {
                  if (!open) {
                    resetRoleDialog();
                    return;
                  }
                  setRoleDialogOpen(true);
                }}
                mode={editingRole ? "edit" : "create"}
                roleName={roleName}
                onRoleNameChange={setRoleName}
                rolePermissionIds={rolePermissionIds}
                onRolePermissionIdsChange={setRolePermissionIds}
                permissions={permissions}
                onSubmit={onSubmitRoleDialog}
                error={
                  editingRole
                    ? updateRole.error
                      ? getErrorMessage(updateRole.error)
                      : null
                    : createRole.error
                      ? getErrorMessage(createRole.error)
                      : null
                }
                isPending={editingRole ? updateRole.isPending : createRole.isPending}
              />
            ) : null}
            <FormError message={deleteRole.error ? getErrorMessage(deleteRole.error) : null} />
          </TabsContent>
          ) : null}

          <TabsContent value="access">
            <AccessSettingsCard project={selectedProject} isSharedProject={isSharedProject} />
          </TabsContent>

          {canDeleteSelectedProject ? (
          <TabsContent value="danger">
            <DangerSettingsCard
              project={selectedProject}
              canDelete={canDeleteSelectedProject}
              isPending={deleteProject.isPending}
              error={deleteProject.error ? getErrorMessage(deleteProject.error) : null}
              onDelete={() => deleteProject.mutate(selectedProject.id)}
            />
          </TabsContent>
          ) : null}
        </Tabs>
      ) : null}
    </div>
  );
}

function getSettingsSection(value: string | null): SettingsSection {
  if (value === "members" || value === "roles" || value === "access" || value === "danger") {
    return value;
  }

  return "general";
}

function getVisibleSettingsSection(
  section: SettingsSection,
  canViewMembers: boolean,
  canViewRoles: boolean,
  canDeleteProject: boolean,
): SettingsSection {
  if (section === "members" && !canViewMembers) {
    return "general";
  }
  if (section === "roles" && !canViewRoles) {
    return "general";
  }
  if (section === "danger" && !canDeleteProject) {
    return "general";
  }

  return section;
}

function PageTitle() {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-muted-foreground">Parametres projet</p>
      <h1 className="mt-1 text-2xl font-semibold">Configuration du projet</h1>
    </div>
  );
}

function GeneralSettingsCard({
  form,
  canEdit,
  isPending,
  error,
  onSubmit,
}: {
  form: ReturnType<typeof useForm<ProjectFormValues>>;
  canEdit: boolean;
  isPending: boolean;
  error: string | null;
  onSubmit: (values: ProjectFormValues) => void;
}) {
  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle>General</CardTitle>
      </CardHeader>
      <CardContent>
        {!canEdit ? (
          <Alert className="mb-4">
            <AlertDescription>
              Lecture seule: il faut la permission project.edit pour modifier ces informations.
            </AlertDescription>
          </Alert>
        ) : null}

        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <Field>
            <FieldLabel htmlFor="project-settings-name">Nom du projet</FieldLabel>
            <Input id="project-settings-name" disabled={!canEdit} {...form.register("name")} />
            <FieldError errors={[form.formState.errors.name]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="project-settings-description">Description</FieldLabel>
            <Textarea
              id="project-settings-description"
              rows={5}
              placeholder="Contexte, objectif ou notes utiles"
              disabled={!canEdit}
              {...form.register("description")}
            />
          </Field>

          <FormError message={error} />

          <Button type="submit" disabled={!canEdit || isPending}>
            <Save className="size-4" />
            {isPending ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function AccessSettingsCard({
  project,
  isSharedProject,
}: {
  project: Project;
  isSharedProject: boolean;
}) {
  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle>Acces</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="rounded-md border bg-muted/30 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">
                {isSharedProject ? "Projet partage avec toi" : "Tu es proprietaire de ce projet"}
              </p>
              <p className="mt-1 text-muted-foreground">
                {isSharedProject
                  ? `Partage par ${project.owner_display_name}`
                  : "Tu as acces a toutes les actions du projet."}
              </p>
            </div>
            <Badge variant={isSharedProject ? "secondary" : "outline"}>
              {isSharedProject ? "Membre" : "Proprietaire"}
            </Badge>
          </div>
        </div>

        <Separator />

        <div>
          <p className="font-medium">Permissions actives</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {!isSharedProject ? (
              <Badge variant="secondary">Toutes les permissions</Badge>
            ) : project.current_user_permission_codes.length > 0 ? (
              project.current_user_permission_codes.map((code) => (
                <Badge key={code} variant="secondary">
                  {formatPermissionCode(code)}
                </Badge>
              ))
            ) : (
              <span className="text-muted-foreground">Aucune permission de role.</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DangerSettingsCard({
  project,
  canDelete,
  isPending,
  error,
  onDelete,
}: {
  project: Project;
  canDelete: boolean;
  isPending: boolean;
  error: string | null;
  onDelete: () => void;
}) {
  return (
    <Card className="rounded-lg border-destructive/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="size-4" />
          Zone sensible
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-6 text-muted-foreground">
          Seul le proprietaire du projet peut supprimer {project.name}.
        </p>
        <Separator />
        <Button variant="destructive" onClick={onDelete} disabled={!canDelete || isPending}>
          <Trash2 className="size-4" />
          {isPending ? "Suppression..." : "Supprimer le projet"}
        </Button>
        {!canDelete ? <p className="text-xs text-muted-foreground">Action indisponible pour ton role actuel.</p> : null}
        <FormError message={error} />
      </CardContent>
    </Card>
  );
}

function MemberAvatar({ name, pictureUrl }: { name: string; pictureUrl: string | null }) {
  const initial = name.charAt(0).toUpperCase();
  if (pictureUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={pictureUrl} alt={name} className="size-8 shrink-0 rounded-full object-cover" />;
  }
  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
      {initial}
    </div>
  );
}

function EmptySettingsState({ onCreateProject }: { onCreateProject: () => void }) {
  return (
    <Empty className="border bg-card p-8">
      <EmptyHeader>
        <EmptyTitle>Aucun projet a configurer</EmptyTitle>
        <EmptyDescription>
          Cree un projet depuis la barre laterale pour acceder a ses parametres.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={onCreateProject}>Creer un projet</Button>
      </EmptyContent>
    </Empty>
  );
}

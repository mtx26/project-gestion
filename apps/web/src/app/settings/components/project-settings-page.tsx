"use client";

import type { Project, Permission } from "@project-gestion/types";
import { projectSchema, type ProjectFormValues } from "@project-gestion/validation";
import { zodResolver } from "@hookform/resolvers/zod";
import { queryKeys } from "@project-gestion/query-keys";
import {
  canDeleteProject,
  canEditProject,
  formatPermissionCode,
  hasProjectPermission,
  permissionCodes,
} from "@project-gestion/permissions";
import { normalizeApiList } from "@project-gestion/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Save, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { FormError } from "@/components/forms/form-error";
import { ProjectWorkspaceShell, type ProjectWorkspaceState } from "@/components/dashboard/project-workspace-shell";
import { MembersSettingsTab } from "@/app/settings/components/members-settings-tab";
import { RolesSettingsTab } from "@/app/settings/components/roles-settings-tab";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";

type SettingsSection = "general" | "members" | "roles" | "access" | "danger";

function getSettingsSection(value: string | null): SettingsSection {
  if (value === "members" || value === "roles" || value === "access" || value === "danger") return value;
  return "general";
}

function getVisibleSettingsSection(
  section: SettingsSection,
  canViewMembers: boolean,
  canViewRoles: boolean,
  canDeleteProject: boolean,
): SettingsSection {
  if (section === "members" && !canViewMembers) return "general";
  if (section === "roles" && !canViewRoles) return "general";
  if (section === "danger" && !canDeleteProject) return "general";
  return section;
}

export function ProjectSettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSection = getSettingsSection(searchParams.get("tab"));
  const buildSettingsHref = (projectId: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("project", String(projectId));
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
  initialSection,
}: ProjectWorkspaceState & { initialSection: SettingsSection }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const canEditSelectedProject = canEditProject(selectedProject, user?.id ?? null);
  const canDeleteSelectedProject = canDeleteProject(selectedProject, user?.id ?? null);
  const canViewMembers = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.memberView);
  const canManageMembers = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.memberEdit);
  const canViewRoles = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.roleView);
  const canManageRoles = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.roleEdit);
  const canDeleteRoles = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.roleDelete);
  const isSharedProject = Boolean(user && selectedProject && selectedProject.owner !== user.id);

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

  const roles = normalizeApiList(rolesQuery.data);
  const permissions = normalizeApiList(permissionsQuery.data) as Permission[];

  const visibleSection = getVisibleSettingsSection(
    initialSection,
    canViewMembers,
    canViewRoles,
    canDeleteSelectedProject,
  );

  const editForm = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: { name: "", description: "" },
  });

  useEffect(() => {
    editForm.reset({
      name: selectedProject?.name ?? "",
      description: selectedProject?.description ?? "",
    });
  }, [editForm, selectedProject]);

  const updateProject = useMutation({
    mutationFn: ({ id, values }: { id: number; values: ProjectFormValues }) =>
      api.projects.update(id, { name: values.name, description: values.description?.trim() || null }),
    onSuccess: async () => {
      toast.success("Projet mis a jour");
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });

  const deleteProject = useMutation({
    mutationFn: api.projects.remove,
    onSuccess: async (_data, deletedProjectId) => {
      const nextProject = projects.find((p) => p.id !== deletedProjectId);
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      router.push(nextProject ? `/settings?project=${nextProject.id}` : "/dashboard");
    },
  });

  function onSettingsSectionChange(value: string) {
    const nextSection = getSettingsSection(value);
    if (!selectedProject) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("project", String(selectedProject.id));
    if (nextSection === "general") params.delete("tab"); else params.set("tab", nextSection);
    router.replace(`/settings?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-medium uppercase text-muted-foreground">Parametres projet</p>
        <h1 className="mt-1 text-2xl font-semibold">Configuration du projet</h1>
      </div>

      {!projectsQuery.isLoading && !selectedProject ? (
        <Empty className="border bg-card p-8">
          <EmptyHeader>
            <EmptyTitle>Aucun projet a configurer</EmptyTitle>
            <EmptyDescription>
              Cree un projet depuis la barre laterale pour acceder a ses parametres.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={openCreateProject}>Creer un projet</Button>
          </EmptyContent>
        </Empty>
      ) : null}

      {selectedProject ? (
        <Tabs value={visibleSection} onValueChange={onSettingsSectionChange}>
          <div>
            <TabsList className="h-auto w-max">
              <TabsTrigger value="general" className="min-w-28 flex-none px-3 py-2">General</TabsTrigger>
              {canViewMembers ? (
                <TabsTrigger value="members" className="min-w-28 flex-none px-3 py-2">Membres</TabsTrigger>
              ) : null}
              {canViewRoles ? (
                <TabsTrigger value="roles" className="min-w-28 flex-none px-3 py-2">Roles</TabsTrigger>
              ) : null}
              <TabsTrigger value="access" className="min-w-28 flex-none px-3 py-2">Acces</TabsTrigger>
              {canDeleteSelectedProject ? (
                <TabsTrigger value="danger" className="min-w-32 flex-none px-3 py-2">Zone sensible</TabsTrigger>
              ) : null}
            </TabsList>
          </div>

          <TabsContent value="general">
            <GeneralSettingsCard
              form={editForm}
              canEdit={canEditSelectedProject}
              isPending={updateProject.isPending}
              error={getErrorMessage(updateProject.error)}
              onSubmit={(values) => {
                if (selectedProject && canEditSelectedProject) {
                  updateProject.mutate({ id: selectedProject.id, values });
                }
              }}
            />
          </TabsContent>

          {canViewMembers ? (
            <TabsContent value="members">
              <MembersSettingsTab
                selectedProject={selectedProject}
                queryClient={queryClient}
                roles={roles}
                userId={user?.id ?? null}
                canManageMembers={canManageMembers}
                canEditOwnRate={hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.memberEditOwnRate)}
                canEditRates={hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.memberEditRates)}
              />
            </TabsContent>
          ) : null}

          {canViewRoles ? (
            <TabsContent value="roles">
              <RolesSettingsTab
                selectedProject={selectedProject}
                queryClient={queryClient}
                permissions={permissions}
                canManageRoles={canManageRoles}
                canDeleteRoles={canDeleteRoles}
              />
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
                error={getErrorMessage(deleteProject.error)}
                onDelete={() => deleteProject.mutate(selectedProject.id)}
              />
            </TabsContent>
          ) : null}
        </Tabs>
      ) : null}
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

function AccessSettingsCard({ project, isSharedProject }: { project: Project; isSharedProject: boolean }) {
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
        {!canDelete ? (
          <p className="text-xs text-muted-foreground">Action indisponible pour ton role actuel.</p>
        ) : null}
        <FormError message={error} />
      </CardContent>
    </Card>
  );
}

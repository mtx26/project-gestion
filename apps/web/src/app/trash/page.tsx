"use client";

import type { Folder, Project, Task, TimeEntry } from "@project-gestion/types";
import { hasProjectPermission, permissionCodes } from "@project-gestion/permissions";
import { normalizeApiList } from "@project-gestion/api";
import { queryKeys } from "@project-gestion/query-keys";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Clock3, Folder as FolderIcon, ListTodo, Lock, RotateCcw } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { ProjectWorkspaceShell, type ProjectWorkspaceState } from "@/components/dashboard/project-workspace-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { formatDuration } from "@/lib/task-utils";

function buildTrashHref(projectId: number | string, params: URLSearchParams) {
  const next = new URLSearchParams({ project: String(projectId) });
  const tab = params.get("tab");
  if (tab) next.set("tab", tab);
  return `/trash?${next}`;
}

export default function TrashPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <ProjectWorkspaceShell
      activeItem="trash"
      selectedProjectIdFromUrl={searchParams.get("project") ?? ""}
      onProjectSelected={(id) => router.push(buildTrashHref(id, searchParams))}
      onProjectCreated={(project) => router.push(buildTrashHref(project.id, searchParams))}
    >
      {(state) => <TrashPageContent {...state} />}
    </ProjectWorkspaceShell>
  );
}

function TrashPageContent({ user, selectedProject, queryClient }: ProjectWorkspaceState) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = searchParams.get("tab") ?? "projects";
  const projectId = selectedProject?.id ?? null;

  const canViewFiles = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.fileView);
  const canRestoreFiles = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.fileRestore);
  const canViewTasks = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.taskView);
  const canRestoreTasks = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.taskRestore);
  const canViewTime = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.timeEntryView);
  const canRestoreTime = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.timeEntryRestore);

  function setTab(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    router.push(`/trash?${params}`);
  }

  const projectsTrashQuery = useQuery({
    queryKey: queryKeys.projects.trash(),
    queryFn: api.projects.trash,
  });
  const restoreProject = useMutation({
    mutationFn: (id: number) => api.projects.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.trash() });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.lists() });
    },
  });

  const foldersTrashQuery = useQuery({
    queryKey: projectId ? queryKeys.folders.trash(projectId) : ["folders", "trash", "disabled"],
    queryFn: () => api.folders.trash(projectId!),
    enabled: Boolean(projectId && canRestoreFiles),
  });
  const restoreFolder = useMutation({
    mutationFn: (folderId: number) => api.folders.restore(projectId!, folderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.folders.trash(projectId!) });
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "folders", "tree"] });
    },
  });

  const tasksTrashQuery = useQuery({
    queryKey: projectId ? queryKeys.tasks.trash(projectId) : ["tasks", "trash", "disabled"],
    queryFn: () => api.tasks.trash(projectId!),
    enabled: Boolean(projectId && canRestoreTasks),
  });
  const restoreTask = useMutation({
    mutationFn: (taskId: number) => api.tasks.restore(projectId!, taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.trash(projectId!) });
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "tasks"] });
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "folders", "tree"] });
    },
  });

  const timeEntriesTrashQuery = useQuery({
    queryKey: projectId ? queryKeys.timeEntries.trash(projectId) : ["time-entries", "trash", "disabled"],
    queryFn: () => api.timeEntries.trash(projectId!),
    enabled: Boolean(projectId && canRestoreTime),
  });
  const restoreTimeEntry = useMutation({
    mutationFn: (timeEntryId: number) => api.timeEntries.restore(projectId!, timeEntryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.timeEntries.trash(projectId!) });
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "time-entries"] });
    },
  });

  const deletedProjects = normalizeApiList(projectsTrashQuery.data);
  const folders = normalizeApiList(foldersTrashQuery.data);
  const tasks = normalizeApiList(tasksTrashQuery.data);
  const timeEntries = normalizeApiList(timeEntriesTrashQuery.data);

  const noProjectMsg = (
    <p className="py-8 text-center text-sm text-muted-foreground">Selectionnez un projet pour voir cet onglet.</p>
  );

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-medium uppercase text-muted-foreground">Corbeille</p>
        <h1 className="mt-1 text-2xl font-semibold">Elements supprimes</h1>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="projects" className="gap-2">
            Projets
            {deletedProjects.length > 0 ? (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs">{deletedProjects.length}</span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="folders" className="gap-2">
            {selectedProject && !canRestoreFiles ? (
              <Lock className="size-4 text-muted-foreground" />
            ) : (
              <FolderIcon className="size-4" />
            )}
            Dossiers
            {folders.length > 0 ? (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs">{folders.length}</span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-2">
            {selectedProject && !canRestoreTasks ? (
              <Lock className="size-4 text-muted-foreground" />
            ) : (
              <ListTodo className="size-4" />
            )}
            Taches
            {tasks.length > 0 ? (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs">{tasks.length}</span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="time" className="gap-2">
            {selectedProject && !canRestoreTime ? (
              <Lock className="size-4 text-muted-foreground" />
            ) : (
              <Clock3 className="size-4" />
            )}
            Temps
            {timeEntries.length > 0 ? (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs">{timeEntries.length}</span>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="projects" className="mt-4">
          <TrashSection<Project>
            isLoading={projectsTrashQuery.isLoading}
            canRestore={true}
            items={deletedProjects}
            getName={(p) => p.name}
            getSubtitle={(p) => formatDeletedAt(p.deleted_at)}
            onRestore={(p) => restoreProject.mutate(p.id)}
            isRestoring={restoreProject.isPending}
            emptyText="Aucun projet supprime."
          />
        </TabsContent>

        <TabsContent value="folders" className="mt-4">
          {!selectedProject ? noProjectMsg : !canRestoreFiles ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Vous n&apos;avez pas acces a cet onglet.</p>
          ) : (
            <TrashSection<Folder>
              isLoading={foldersTrashQuery.isLoading}
              canRestore={canRestoreFiles}
              items={folders}
              getName={(f) => f.name}
              getSubtitle={(f) => formatDeletedAt(f.deleted_at)}
              onRestore={(f) => restoreFolder.mutate(f.id)}
              isRestoring={restoreFolder.isPending}
              emptyText="Aucun dossier supprime."
            />
          )}
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          {!selectedProject ? noProjectMsg : !canRestoreTasks ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Vous n&apos;avez pas acces a cet onglet.</p>
          ) : (
            <TrashSection<Task>
              isLoading={tasksTrashQuery.isLoading}
              canRestore={canRestoreTasks}
              items={tasks}
              getName={(t) => t.title}
              getSubtitle={(t) => formatDeletedAt(t.deleted_at)}
              onRestore={(t) => restoreTask.mutate(t.id)}
              isRestoring={restoreTask.isPending}
              emptyText="Aucune tache supprimee."
            />
          )}
        </TabsContent>

        <TabsContent value="time" className="mt-4">
          {!selectedProject ? noProjectMsg : !canRestoreTime ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Vous n&apos;avez pas acces a cet onglet.</p>
          ) : (
            <TrashSection<TimeEntry>
              isLoading={timeEntriesTrashQuery.isLoading}
              canRestore={canRestoreTime}
              items={timeEntries}
              getName={(e) => e.description || formatDuration(e.duration_minutes)}
              getSubtitle={(e) => formatDeletedAt(e.deleted_at)}
              onRestore={(e) => restoreTimeEntry.mutate(e.id)}
              isRestoring={restoreTimeEntry.isPending}
              emptyText="Aucune entree de temps supprimee."
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TrashSection<T extends { id: number }>({
  isLoading,
  canRestore,
  items,
  getName,
  getSubtitle,
  onRestore,
  isRestoring,
  emptyText,
}: {
  isLoading: boolean;
  canRestore: boolean;
  items: T[];
  getName: (item: T) => string;
  getSubtitle: (item: T) => string;
  onRestore: (item: T) => void;
  isRestoring: boolean;
  emptyText: string;
}) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center justify-between gap-4 rounded-lg border bg-card px-4 py-3"
        >
          <div className="min-w-0">
            <p className="truncate font-medium">{getName(item)}</p>
            <p className="truncate text-xs text-muted-foreground">{getSubtitle(item)}</p>
          </div>
          {canRestore ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-2"
              onClick={() => onRestore(item)}
              disabled={isRestoring}
            >
              <RotateCcw className="size-3.5" />
              Restaurer
            </Button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function formatDeletedAt(deletedAt: string | null): string {
  if (!deletedAt) return "";
  return `Supprime le ${new Date(deletedAt).toLocaleDateString("fr-BE")}`;
}

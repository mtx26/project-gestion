"use client";

import type { ExpenseRequest, File as ApiFile, FinancialEntry, Folder, Project, Task, TimeEntry } from "@project-gestion/types";
import { hasProjectPermission, permissionCodes } from "@project-gestion/permissions";
import { normalizeApiList } from "@project-gestion/api";
import { queryKeys } from "@project-gestion/query-keys";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Clock3, FileText, Folder as FolderIcon, ListTodo, Lock, Receipt, RotateCcw, Wallet } from "lucide-react";
import { PageTitle } from "@/components/ui/page-title";
import { formatBytes, formatDuration, formatMoney } from "@/lib/task-utils";
import { useRouter, useSearchParams } from "next/navigation";
import { ProjectWorkspaceShell, type ProjectWorkspaceState } from "@/components/dashboard/project-workspace-shell";
import { Button } from "@/components/ui/button";
import { SkeletonLoader } from "@/components/ui/skeleton-loader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";

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

  const canRestoreFiles = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.fileRestore);
  const canRestoreTasks = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.taskRestore);
  const canRestoreTime = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.timeEntryRestore);
  const canRestoreFinance = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.financeRestore);
  const canRestoreExpenseRequests = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.expenseRequestRestore);

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

  const documentsTrashQuery = useQuery({
    queryKey: projectId ? queryKeys.documents.trash(projectId) : ["documents", "trash", "disabled"],
    queryFn: () => api.documents.trash(projectId!),
    enabled: Boolean(projectId && canRestoreFiles),
  });
  const restoreDocument = useMutation({
    mutationFn: (docId: number) => api.documents.restore(projectId!, docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.trash(projectId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.list(projectId!) });
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

  const financialEntriesTrashQuery = useQuery({
    queryKey: projectId ? queryKeys.financialEntries.trash(projectId) : ["financial-entries", "trash", "disabled"],
    queryFn: () => api.financialEntries.trash(projectId!),
    enabled: Boolean(projectId && canRestoreFinance),
  });
  const restoreFinancialEntry = useMutation({
    mutationFn: (entryId: number) => api.financialEntries.restore(projectId!, entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.financialEntries.trash(projectId!) });
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "financial-entries"] });
    },
  });

  const expenseRequestsTrashQuery = useQuery({
    queryKey: projectId ? queryKeys.expenseRequests.trash(projectId) : ["expense-requests", "trash", "disabled"],
    queryFn: () => api.expenseRequests.trash(projectId!),
    enabled: Boolean(projectId && canRestoreExpenseRequests),
  });
  const restoreExpenseRequest = useMutation({
    mutationFn: (id: number) => api.expenseRequests.restore(projectId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenseRequests.trash(projectId!) });
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "expense-requests"] });
    },
  });

  const deletedProjects = normalizeApiList(projectsTrashQuery.data);
  const folders = normalizeApiList(foldersTrashQuery.data);
  const documents = normalizeApiList(documentsTrashQuery.data);
  const tasks = normalizeApiList(tasksTrashQuery.data);
  const timeEntries = normalizeApiList(timeEntriesTrashQuery.data);
  const financialEntries = normalizeApiList(financialEntriesTrashQuery.data);
  const expenseRequests = normalizeApiList(expenseRequestsTrashQuery.data);

  const lockedMsg = <p className="py-8 text-center text-sm text-muted-foreground">Vous n&apos;avez pas acces a cet onglet.</p>;
  const noProjectMsg = <p className="py-8 text-center text-sm text-muted-foreground">Selectionnez un projet pour voir cet onglet.</p>;

  return (
    <div className="space-y-5">
      <div>
        <PageTitle category="Corbeille" title="Elements supprimes" />
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
          <TabsTrigger value="documents" className="gap-2">
            {selectedProject && !canRestoreFiles ? (
              <Lock className="size-4 text-muted-foreground" />
            ) : (
              <FileText className="size-4" />
            )}
            Documents
            {documents.length > 0 ? (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs">{documents.length}</span>
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
          <TabsTrigger value="finance" className="gap-2">
            {selectedProject && !canRestoreFinance ? (
              <Lock className="size-4 text-muted-foreground" />
            ) : (
              <Wallet className="size-4" />
            )}
            Finance
            {financialEntries.length > 0 ? (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs">{financialEntries.length}</span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="requests" className="gap-2">
            {selectedProject && !canRestoreExpenseRequests ? (
              <Lock className="size-4 text-muted-foreground" />
            ) : (
              <Receipt className="size-4" />
            )}
            Remboursements
            {expenseRequests.length > 0 ? (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs">{expenseRequests.length}</span>
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
          {!selectedProject ? noProjectMsg : !canRestoreFiles ? lockedMsg : (
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

        <TabsContent value="documents" className="mt-4">
          {!selectedProject ? noProjectMsg : !canRestoreFiles ? lockedMsg : (
            <DocumentTrashSection
              isLoading={documentsTrashQuery.isLoading}
              items={documents}
              onRestore={(d) => restoreDocument.mutate(d.id)}
              isRestoring={restoreDocument.isPending}
            />
          )}
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          {!selectedProject ? noProjectMsg : !canRestoreTasks ? lockedMsg : (
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
          {!selectedProject ? noProjectMsg : !canRestoreTime ? lockedMsg : (
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

        <TabsContent value="finance" className="mt-4">
          {!selectedProject ? noProjectMsg : !canRestoreFinance ? lockedMsg : (
            <TrashSection<FinancialEntry>
              isLoading={financialEntriesTrashQuery.isLoading}
              canRestore={canRestoreFinance}
              items={financialEntries}
              getName={(e) => e.description || e.category || formatMoney(e.amount)}
              getSubtitle={(e) => `${e.type === "expense" ? "Depense" : "Remboursement"} · ${formatMoney(e.amount)} · ${formatDeletedAt(e.deleted_at)}`}
              onRestore={(e) => restoreFinancialEntry.mutate(e.id)}
              isRestoring={restoreFinancialEntry.isPending}
              emptyText="Aucune entree financiere supprimee."
            />
          )}
        </TabsContent>

        <TabsContent value="requests" className="mt-4">
          {!selectedProject ? noProjectMsg : !canRestoreExpenseRequests ? lockedMsg : (
            <TrashSection<ExpenseRequest>
              isLoading={expenseRequestsTrashQuery.isLoading}
              canRestore={canRestoreExpenseRequests}
              items={expenseRequests}
              getName={(e) => e.title}
              getSubtitle={(e) => `${formatMoney(e.amount)} · ${formatDeletedAt(e.deleted_at)}`}
              onRestore={(e) => restoreExpenseRequest.mutate(e.id)}
              isRestoring={restoreExpenseRequest.isPending}
              emptyText="Aucune demande de remboursement supprimee."
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function getFileTypeLabel(mimeType: string | null, fileName: string): string {
  if (!mimeType) {
    const ext = fileName.split(".").pop()?.toUpperCase();
    return ext ?? "Fichier";
  }
  if (mimeType.startsWith("image/")) return "Image";
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "Tableur";
  if (mimeType.includes("word") || mimeType.includes("document")) return "Document";
  if (mimeType.startsWith("video/")) return "Video";
  if (mimeType.startsWith("audio/")) return "Audio";
  const ext = fileName.split(".").pop()?.toUpperCase();
  return ext ?? "Fichier";
}

function DocumentTrashSection({
  isLoading,
  items,
  onRestore,
  isRestoring,
}: {
  isLoading: boolean;
  items: ApiFile[];
  onRestore: (item: ApiFile) => void;
  isRestoring: boolean;
}) {
  if (isLoading) {
    return (
      <SkeletonLoader count={3} className="h-16 w-full rounded-lg" />
    );
  }

  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Aucun document supprime.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((doc) => (
        <div key={doc.id} className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted">
            <FileText className="size-5 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{doc.name}</p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0 text-xs text-muted-foreground">
              <span>{getFileTypeLabel(doc.mime_type, doc.file_name)}</span>
              {doc.file_size ? <span>{formatBytes(doc.file_size)}</span> : null}
              <span>{formatDeletedAt(doc.deleted_at)}</span>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-2"
            onClick={() => onRestore(doc)}
            disabled={isRestoring}
          >
            <RotateCcw className="size-3.5" />
            Restaurer
          </Button>
        </div>
      ))}
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
      <SkeletonLoader count={3} />
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

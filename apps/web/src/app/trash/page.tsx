"use client";

import type { ExpenseRequest, File as ApiFile, FinancialEntry, Folder, Project, Task, TimeEntry } from "@project-gestion/types";
import { hasProjectPermission, permissionCodes } from "@project-gestion/permissions";
import { normalizeApiList } from "@project-gestion/api";
import { queryKeys } from "@project-gestion/query-keys";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3, FileText, Folder as FolderIcon, ListTodo, Lock, Receipt, RotateCcw, Wallet } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { formatBytes, formatDuration, formatMoney } from "@/lib/task-utils";
import { useRouter, useSearchParams } from "next/navigation";
import { ProjectWorkspaceShell, type ProjectWorkspaceState } from "@/components/dashboard/project-workspace-shell";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { NoProjectState } from "@/components/states/no-project-state";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
import { SkeletonLoader } from "@/components/states/skeleton-loader";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/scrollable-tabs-list";
import { api } from "@/lib/api";
import { toastError } from "@/lib/errors";
import { buildProjectHref } from "@/lib/url-params";

export default function TrashPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <ProjectWorkspaceShell
      activeItem="trash"
      selectedProjectIdFromUrl={searchParams.get("project") ?? ""}
      onProjectSelected={(id) => router.push(buildProjectHref("/trash", id, searchParams))}
      onProjectCreated={(project) => router.push(buildProjectHref("/trash", project.id, searchParams))}
    >
      {(state) => <TrashPageContent {...state} />}
    </ProjectWorkspaceShell>
  );
}

function TrashPageContent({ user, selectedProject, openCreateProject }: ProjectWorkspaceState) {
  const queryClient = useQueryClient();
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

  const lockedFiles = !!(selectedProject && !canRestoreFiles);
  const lockedTasks = !!(selectedProject && !canRestoreTasks);
  const lockedTime = !!(selectedProject && !canRestoreTime);
  const lockedFinance = !!(selectedProject && !canRestoreFinance);
  const lockedRequests = !!(selectedProject && !canRestoreExpenseRequests);

  const disabledByTab: Record<string, boolean> = {
    folders: lockedFiles, documents: lockedFiles, tasks: lockedTasks,
    time: lockedTime, finance: lockedFinance, requests: lockedRequests,
  };

  useEffect(() => {
    if (disabledByTab[tab]) setTab("projects");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, lockedFiles, lockedTasks, lockedTime, lockedFinance, lockedRequests]);

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
    onError: toastError,
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
      queryClient.invalidateQueries({ queryKey: queryKeys.folders.allTree(projectId!) });
    },
    onError: toastError,
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
      queryClient.invalidateQueries({ queryKey: queryKeys.folders.allTree(projectId!) });
    },
    onError: toastError,
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
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all(projectId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.folders.allTree(projectId!) });
    },
    onError: toastError,
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
      queryClient.invalidateQueries({ queryKey: queryKeys.timeEntries.all(projectId!) });
    },
    onError: toastError,
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
      queryClient.invalidateQueries({ queryKey: queryKeys.financialEntries.all(projectId!) });
    },
    onError: toastError,
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
      queryClient.invalidateQueries({ queryKey: queryKeys.expenseRequests.all(projectId!) });
    },
    onError: toastError,
  });

  const deletedProjects = normalizeApiList(projectsTrashQuery.data);
  const folders = normalizeApiList(foldersTrashQuery.data);
  const documents = normalizeApiList(documentsTrashQuery.data);
  const tasks = normalizeApiList(tasksTrashQuery.data);
  const timeEntries = normalizeApiList(timeEntriesTrashQuery.data);
  const financialEntries = normalizeApiList(financialEntriesTrashQuery.data);
  const expenseRequests = normalizeApiList(expenseRequestsTrashQuery.data);

  const lockedMsg = (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon"><Lock className="size-4" /></EmptyMedia>
        <EmptyTitle>Acces restreint</EmptyTitle>
        <EmptyDescription>Vous n&apos;avez pas acces a cet onglet.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
  const noProjectMsg = (
    <NoProjectState
      icon={RotateCcw}
      description="Cree ou selectionne un projet pour voir la corbeille."
      onCreateProject={openCreateProject}
    />
  );

  return (
    <div className="space-y-5">
      <div>
        <PageTitle category="Corbeille" title="Elements supprimes" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <ScrollableTabsList>
          <TabsTrigger value="projects" className="gap-2">
            Projets
            {deletedProjects.length > 0 ? (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs">{deletedProjects.length}</span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="folders" className="gap-2" disabled={lockedFiles}>
            {lockedFiles ? <Lock className="size-4" /> : <FolderIcon className="size-4" />}
            Dossiers
            {folders.length > 0 ? (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs">{folders.length}</span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-2" disabled={lockedFiles}>
            {lockedFiles ? <Lock className="size-4" /> : <FileText className="size-4" />}
            Documents
            {documents.length > 0 ? (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs">{documents.length}</span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-2" disabled={lockedTasks}>
            {lockedTasks ? <Lock className="size-4" /> : <ListTodo className="size-4" />}
            Taches
            {tasks.length > 0 ? (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs">{tasks.length}</span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="time" className="gap-2" disabled={lockedTime}>
            {lockedTime ? <Lock className="size-4" /> : <Clock3 className="size-4" />}
            Temps
            {timeEntries.length > 0 ? (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs">{timeEntries.length}</span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="finance" className="gap-2" disabled={lockedFinance}>
            {lockedFinance ? <Lock className="size-4" /> : <Wallet className="size-4" />}
            Finance
            {financialEntries.length > 0 ? (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs">{financialEntries.length}</span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="requests" className="gap-2" disabled={lockedRequests}>
            {lockedRequests ? <Lock className="size-4" /> : <Receipt className="size-4" />}
            Remboursements
            {expenseRequests.length > 0 ? (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs">{expenseRequests.length}</span>
            ) : null}
          </TabsTrigger>
        </ScrollableTabsList>

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
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Aucun document supprime.</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ItemGroup>
      {items.map((doc) => (
        <Item key={doc.id} variant="outline">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted">
            <FileText className="size-5 text-muted-foreground" />
          </div>
          <ItemContent>
            <ItemTitle>{doc.name}</ItemTitle>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0 text-xs text-muted-foreground">
              <span>{getFileTypeLabel(doc.mime_type, doc.file_name)}</span>
              {doc.file_size ? <span>{formatBytes(doc.file_size)}</span> : null}
              <span>{formatDeletedAt(doc.deleted_at)}</span>
            </div>
          </ItemContent>
          <ItemActions>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onRestore(doc)}
              disabled={isRestoring}
            >
              <RotateCcw className="size-3.5" />
              Restaurer
            </Button>
          </ItemActions>
        </Item>
      ))}
    </ItemGroup>
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
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{emptyText}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ItemGroup>
      {items.map((item) => (
        <Item key={item.id} variant="outline">
          <ItemContent>
            <ItemTitle>{getName(item)}</ItemTitle>
            <ItemDescription>{getSubtitle(item)}</ItemDescription>
          </ItemContent>
          {canRestore ? (
            <ItemActions>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onRestore(item)}
                disabled={isRestoring}
              >
                <RotateCcw className="size-3.5" />
                Restaurer
              </Button>
            </ItemActions>
          ) : null}
        </Item>
      ))}
    </ItemGroup>
  );
}

function formatDeletedAt(deletedAt: string | null): string {
  if (!deletedAt) return "";
  return `Supprime le ${new Date(deletedAt).toLocaleDateString("fr-BE")}`;
}

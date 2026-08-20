import { isFolderDescendantOf } from "@project-gestion/domain";
import { permissionCodes } from "@project-gestion/permissions";
import type { FolderTreeNode, Project, Task } from "@project-gestion/types";
import { useRouter } from "expo-router";
import { FolderPlus, Upload } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { EmptyState } from "../../../components/feedback/EmptyState";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { ProjectSectionScreen } from "../../../components/layout/ProjectSectionScreen";
import { NameSheet } from "../../../components/layout/NameSheet";
import { FolderPickerModal } from "../../../components/pickers/FolderPickerModal";
import type { PendingUpload } from "../../../lib/document-picker";
import { getErrorMessage } from "../../../lib/errors";
import { useOpenDocument } from "../../../lib/use-open-document";
import { useUploadPicker } from "../../../lib/use-upload-picker";
import { useActionSheet } from "../../../providers/ActionSheetProvider";
import { theme } from "../../../theme";
import { useAuthStore } from "../../../stores/auth-store";
import { useProjectPermissions } from "../../projects/hooks/use-project-permissions";
import { useTasks } from "../../tasks/hooks/use-tasks";
import { useTimeEntryStats } from "../../time-entries/hooks/use-time-entries";
import { BreadcrumbBar } from "../components/BreadcrumbBar";
import { FileRow } from "../components/FileRow";
import { FolderInfoCard } from "../components/FolderInfoCard";
import {
  useCreateFolder,
  useDeleteDocument,
  useDeleteFolder,
  useMoveDocument,
  useMoveFolder,
  useProjectTree,
  useRenameDocument,
  useRenameFolder,
  useUploadDocument,
} from "../hooks/use-project-tree";
import { getFolderChildren, getFolderPath } from "../lib/tree-navigation";

export function FilesScreen() {
  return (
    <ProjectSectionScreen title="Projet" requiredPermission={permissionCodes.fileView}>
      {(project) => <FilesExplorer project={project} />}
    </ProjectSectionScreen>
  );
}

/** Element vise par le menu d'actions (appui long) ou par une feuille de renommage. */
type ActionTarget = { type: "folder" | "document"; id: number; name: string };

function FilesExplorer({ project }: { project: Project }) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const showActionSheet = useActionSheet();
  const pickUpload = useUploadPicker();
  const { can } = useProjectPermissions(project, user?.id ?? null);
  const canEditFiles = can(permissionCodes.fileEdit);
  const canDeleteFiles = can(permissionCodes.fileDelete);
  const canViewTasks = can(permissionCodes.taskView);
  const canViewTime = can(permissionCodes.timeEntryView);

  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [renameTarget, setRenameTarget] = useState<ActionTarget | null>(null);
  const [moveTarget, setMoveTarget] = useState<ActionTarget | null>(null);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);

  const { tree, isLoading, isFetching, isError, error, refetch } = useProjectTree(project.id);
  const createFolder = useCreateFolder(project.id);
  const renameFolder = useRenameFolder(project.id);
  const moveFolder = useMoveFolder(project.id);
  const deleteFolder = useDeleteFolder(project.id);
  const uploadDocument = useUploadDocument(project.id);
  const renameDocument = useRenameDocument(project.id);
  const moveDocument = useMoveDocument(project.id);
  const deleteDocument = useDeleteDocument(project.id);
  const openDocument = useOpenDocument(project.id);

  // Contenu du dossier courant et taches/temps qui lui sont rattaches : le dossier
  // ouvert sert de scope a tout l'ecran.
  const children = getFolderChildren(tree, currentFolderId);
  const path = getFolderPath(tree, currentFolderId);
  const folderName = path[path.length - 1]?.name ?? "Projet";

  const tasksQuery = useTasks(canViewTasks ? project.id : null, {
    folderId: currentFolderId ?? undefined,
    status: "not_done",
  });
  const timeStatsQuery = useTimeEntryStats(
    project.id,
    { target: currentFolderId == null ? undefined : `folder-${currentFolderId}` },
    canViewTime,
  );

  const mutationError =
    createFolder.error ??
    renameFolder.error ??
    moveFolder.error ??
    deleteFolder.error ??
    uploadDocument.error ??
    renameDocument.error ??
    moveDocument.error ??
    deleteDocument.error ??
    openDocument.error;

  function handleUpload(files: PendingUpload[]) {
    for (const file of files) {
      uploadDocument.mutate({ file, folder: currentFolderId });
    }
  }

  function confirmDelete(target: ActionTarget) {
    const label = target.type === "folder" ? "le dossier" : "le document";
    Alert.alert("Supprimer", `Supprimer definitivement ${label} "${target.name}" ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: () => {
          if (target.type === "folder") {
            deleteFolder.mutate(target.id);
            // Le dossier courant vient de disparaitre : on remonte d'un cran.
            if (target.id === currentFolderId) {
              setCurrentFolderId(path[path.length - 2]?.id ?? null);
            }
          } else {
            deleteDocument.mutate(target.id);
          }
        },
      },
    ]);
  }

  function openActions(node: FolderTreeNode) {
    const target: ActionTarget = {
      type: node.type === "folder" ? "folder" : "document",
      id: node.id,
      name: node.name,
    };
    const options = [
      target.type === "folder"
        ? { label: "Ouvrir le dossier", value: "open" }
        : { label: "Ouvrir le document", value: "open" },
      ...(canEditFiles
        ? [
            { label: "Renommer", value: "rename" },
            { label: "Deplacer", value: "move" },
          ]
        : []),
      ...(canDeleteFiles ? [{ label: "Supprimer", value: "delete", destructive: true }] : []),
    ];

    showActionSheet(target.name, options, (value) => {
      if (value === "open") {
        openNode(node);
      } else if (value === "rename") {
        setRenameTarget(target);
      } else if (value === "move") {
        setMoveTarget(target);
      } else if (value === "delete") {
        confirmDelete(target);
      }
    });
  }

  function openNode(node: FolderTreeNode) {
    if (node.type === "folder") {
      setCurrentFolderId(node.id);
    } else {
      openDocument.mutate(node.id);
    }
  }

  function handleRename(name: string) {
    if (!renameTarget) {
      return;
    }
    const onSuccess = () => setRenameTarget(null);
    if (renameTarget.type === "folder") {
      renameFolder.mutate({ folderId: renameTarget.id, name }, { onSuccess });
    } else {
      renameDocument.mutate({ documentId: renameTarget.id, name }, { onSuccess });
    }
  }

  function handleMove(destinationId: number | null) {
    if (!moveTarget) {
      return;
    }
    if (moveTarget.type === "folder") {
      // Meme garde-fou que le glisser-deposer du web : un dossier ne peut pas
      // atterrir dans son propre sous-arbre (le backend refuse aussi, mais autant
      // le dire tout de suite).
      if (destinationId != null && isFolderDescendantOf(tree, moveTarget.id, destinationId)) {
        Alert.alert(
          "Deplacement impossible",
          "Un dossier ne peut pas etre deplace dans lui-meme ou dans l'un de ses sous-dossiers.",
        );
        return;
      }
      moveFolder.mutate({ folderId: moveTarget.id, newParentId: destinationId });
    } else {
      moveDocument.mutate({ documentId: moveTarget.id, folder: destinationId });
    }
    setMoveTarget(null);
  }

  return (
    <View className="flex-1">
      <FlatList
        data={children}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        contentContainerStyle={
          children.length === 0
            ? { flexGrow: 1, paddingHorizontal: 20 }
            : { paddingHorizontal: 20, paddingBottom: 24 }
        }
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={() => refetch()} />}
        ItemSeparatorComponent={() => <View className="h-2" />}
        ListHeaderComponent={
          <View className="gap-3 pb-3">
            <BreadcrumbBar path={path} onNavigate={setCurrentFolderId} />

            {canEditFiles ? (
              <View className="flex-row gap-2">
                <Pressable
                  onPress={() => setCreateFolderOpen(true)}
                  accessibilityRole="button"
                  className="h-11 flex-1 flex-row items-center justify-center gap-2 rounded-md border border-border bg-surface"
                >
                  <FolderPlus size={theme.iconSize.sm} color={theme.colors.foreground} />
                  <Text className="text-sm font-medium text-foreground">Nouveau dossier</Text>
                </Pressable>
                <Pressable
                  onPress={() => pickUpload(handleUpload)}
                  disabled={uploadDocument.isPending}
                  accessibilityRole="button"
                  android_ripple={{ color: `${theme.colors.primaryForeground}33` }}
                  className="h-11 flex-1 flex-row items-center justify-center gap-2 rounded-md bg-primary"
                  style={{ opacity: uploadDocument.isPending ? 0.6 : 1 }}
                >
                  {uploadDocument.isPending ? (
                    <ActivityIndicator size="small" color={theme.colors.primaryForeground} />
                  ) : (
                    <Upload size={theme.iconSize.sm} color={theme.colors.primaryForeground} />
                  )}
                  <Text className="text-sm font-semibold text-primaryForeground">Importer</Text>
                </Pressable>
              </View>
            ) : null}

            <FolderInfoCard
              folderName={folderName}
              tasks={tasksQuery.tasks}
              isLoadingTasks={tasksQuery.isLoading}
              timeStats={timeStatsQuery.data}
              canViewTasks={canViewTasks}
              canViewTime={canViewTime}
              onOpenTask={(task: Task) =>
                router.push({ pathname: "/tasks/[id]", params: { id: String(task.id) } })
              }
              onOpenTasks={() =>
                router.push({
                  pathname: "/tasks",
                  params: currentFolderId == null ? {} : { folder: `folder-${currentFolderId}` },
                })
              }
              onOpenTime={() =>
                router.push({
                  pathname: "/time",
                  params: currentFolderId == null ? {} : { target: `folder-${currentFolderId}` },
                })
              }
            />

            {isError ? <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} /> : null}
            {mutationError ? <ErrorState message={getErrorMessage(mutationError)} /> : null}
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <LoadingState />
          ) : !isError ? (
            <EmptyState
              title="Dossier vide"
              description={
                canEditFiles
                  ? "Cree un sous-dossier ou importe un fichier pour commencer."
                  : "Aucun element dans ce dossier."
              }
            />
          ) : null
        }
        renderItem={({ item }) => (
          <FileRow
            node={item}
            isOpening={openDocument.isPending && openDocument.variables === item.id}
            onPress={() => openNode(item)}
            onLongPress={() => openActions(item)}
          />
        )}
      />

      <NameSheet
        visible={createFolderOpen}
        title="Nouveau dossier"
        label="Nom du dossier"
        submitLabel="Creer"
        isPending={createFolder.isPending}
        error={getErrorMessage(createFolder.error)}
        onSubmit={(name) =>
          createFolder.mutate(
            { name, parentFolder: currentFolderId },
            { onSuccess: () => setCreateFolderOpen(false) },
          )
        }
        onClose={() => {
          setCreateFolderOpen(false);
          createFolder.reset();
        }}
      />

      <NameSheet
        visible={renameTarget != null}
        title="Renommer"
        label="Nouveau nom"
        initialValue={renameTarget?.name ?? ""}
        submitLabel="Enregistrer"
        isPending={renameFolder.isPending || renameDocument.isPending}
        error={getErrorMessage(renameFolder.error ?? renameDocument.error)}
        onSubmit={handleRename}
        onClose={() => {
          setRenameTarget(null);
          renameFolder.reset();
          renameDocument.reset();
        }}
      />

      {/* Deplacement : on choisit le dossier de destination (la racine du projet
          comprise) dans le meme selecteur d'arbre que les filtres. */}
      <FolderPickerModal
        visible={moveTarget != null}
        folders={tree}
        selectedFolderId={moveTarget?.type === "folder" ? moveTarget.id : currentFolderId}
        onSelect={handleMove}
        onClose={() => setMoveTarget(null)}
      />
    </View>
  );
}

import type { Project } from "@project-gestion/types";
import { RotateCcw } from "lucide-react-native";
import { useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { EmptyState } from "../../../components/feedback/EmptyState";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { FilterPill } from "../../../components/filters/FilterPill";
import { ProjectSectionScreen } from "../../../components/layout/ProjectSectionScreen";
import { getErrorMessage } from "../../../lib/errors";
import { useActionSheet } from "../../../providers/ActionSheetProvider";
import { theme } from "../../../theme";
import { useAuthStore } from "../../../stores/auth-store";
import { useProjectPermissions } from "../../projects/hooks/use-project-permissions";
import { useRestoreTrashItem, useTrashList } from "../hooks/use-trash";
import {
  getAvailableTrashResources,
  getTrashItemLabels,
  TRASH_RESOURCES,
  type TrashItem,
  type TrashResource,
} from "../lib/trash-resources";

export function TrashScreen() {
  return (
    <ProjectSectionScreen title="Corbeille">
      {(project) => <TrashListView project={project} />}
    </ProjectSectionScreen>
  );
}

function TrashListView({ project }: { project: Project }) {
  const user = useAuthStore((state) => state.user);
  const showActionSheet = useActionSheet();
  const { can } = useProjectPermissions(project, user?.id ?? null);

  // Un selecteur plutot que les onglets du web : sept onglets ne tiennent pas en
  // largeur sur un telephone, et les ressources interdites disparaissent du choix
  // au lieu d'apparaitre grisees.
  const resourceOptions = getAvailableTrashResources(can);
  const [resource, setResource] = useState<TrashResource>("projects");

  const { items, count, isLoading, isFetching, isError, error, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useTrashList(project.id, resource);
  const restore = useRestoreTrashItem(project.id, resource);

  function pickResource() {
    showActionSheet("Corbeille", resourceOptions, (value) => setResource(value as TrashResource), resource);
  }

  return (
    <View className="flex-1">
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={
          items.length === 0
            ? { flexGrow: 1, paddingHorizontal: 20 }
            : { paddingHorizontal: 20, paddingBottom: 24 }
        }
        refreshControl={
          <RefreshControl refreshing={isFetching && !isFetchingNextPage} onRefresh={() => refetch()} />
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
        ItemSeparatorComponent={() => <View className="h-2" />}
        ListHeaderComponent={
          <View className="gap-3 pb-3">
            <View className="flex-row items-center gap-2">
              <FilterPill label={TRASH_RESOURCES[resource].label} onPress={pickResource} />
              <Text className="text-sm text-muted">
                {count} element{count > 1 ? "s" : ""}
              </Text>
            </View>

            {isError ? <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} /> : null}
            {restore.error ? <ErrorState message={getErrorMessage(restore.error)} /> : null}
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <LoadingState />
          ) : !isError ? (
            <EmptyState
              title="Corbeille vide"
              description={`Aucun element supprime dans « ${TRASH_RESOURCES[resource].label} ».`}
            />
          ) : null
        }
        ListFooterComponent={isFetchingNextPage ? <LoadingState /> : null}
        renderItem={({ item }) => (
          <TrashRow
            resource={resource}
            item={item}
            isRestoring={restore.isPending && restore.variables === item.id}
            onRestore={() => restore.mutate(item.id)}
          />
        )}
      />
    </View>
  );
}

function TrashRow({
  resource,
  item,
  isRestoring,
  onRestore,
}: {
  resource: TrashResource;
  item: TrashItem;
  isRestoring: boolean;
  onRestore: () => void;
}) {
  const { title, subtitle } = getTrashItemLabels(resource, item);

  return (
    <View className="flex-row items-center gap-3 rounded-md border border-border bg-surface p-4">
      <View className="flex-1 gap-1">
        <Text className="text-base font-medium text-foreground" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-xs text-muted" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Pressable
        onPress={onRestore}
        disabled={isRestoring}
        accessibilityRole="button"
        accessibilityLabel={`Restaurer ${title}`}
        className="h-11 flex-row items-center gap-2 rounded-md border border-border px-3"
        style={{ opacity: isRestoring ? 0.5 : 1 }}
      >
        <RotateCcw size={theme.iconSize.sm} color={theme.colors.primary} />
        <Text className="text-sm font-medium text-primary">{isRestoring ? "..." : "Restaurer"}</Text>
      </Pressable>
    </View>
  );
}

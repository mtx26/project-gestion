import { RotateCcw } from "lucide-react-native";
import { useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyState } from "../../../components/feedback/EmptyState";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { SelectFilterPill } from "../../../components/filters/SelectFilterPill";
import { GlassBar, GLASS_BAR_HEIGHT } from "../../../components/ui/GlassBar";
import { GlassCapsule } from "../../../components/ui/GlassCapsule";
import { getErrorMessage } from "../../../lib/errors";
import { theme } from "../../../theme";
import { useAuthStore } from "../../../stores/auth-store";
import { useProjectPermissions } from "../../projects/hooks/use-project-permissions";
import { useSelectedProject } from "../../projects/hooks/use-selected-project";
import { useRestoreTrashItem, useTrashList } from "../hooks/use-trash";
import { ThemedRefreshControl } from "../../../components/ui/ThemedRefreshControl";
import {
  getAvailableTrashResources,
  getTrashItemLabels,
  TRASH_RESOURCES,
  type TrashItem,
  type TrashResource,
} from "../lib/trash-resources";

/** Seul ecran de projet qui ne se gate pas sur un projet selectionne : la corbeille
 * des *projets* est globale, et c'est justement la qu'on va quand on vient d'en
 * supprimer un (il n'en reste peut-etre aucun). Les ressources du projet, elles,
 * disparaissent du selecteur tant qu'aucun projet n'est ouvert. */
export function TrashScreen() {
  const user = useAuthStore((state) => state.user);
  const { selectedProject } = useSelectedProject();
  const project = selectedProject;
  const { can } = useProjectPermissions(selectedProject, user?.id ?? null);

  // Un selecteur plutot que les onglets du web : sept onglets ne tiennent pas en
  // largeur sur un telephone, et les ressources interdites disparaissent du choix
  // au lieu d'apparaitre grisees.
  const resourceOptions = getAvailableTrashResources(can);
  const [selectedResource, setSelectedResource] = useState<TrashResource>("projects");
  // Changer de projet (ou n'en avoir aucun) peut retirer la ressource affichee : on
  // retombe sur les projets plutot que de laisser une liste vide sans explication.
  const resource = resourceOptions.some((option) => option.value === selectedResource)
    ? selectedResource
    : "projects";

  const { items, count, isLoading, isFetching, isError, error, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useTrashList(project?.id ?? null, resource);
  const restore = useRestoreTrashItem(project?.id ?? null, resource);

  return (
    // No "top" edge: this screen sits below the Drawer's native header.
    <SafeAreaView className="flex-1 bg-background" edges={["bottom", "left", "right"]}>
      <View className="flex-1 pt-4">
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        // Place reservee au selecteur de ressource flottant.
        contentContainerStyle={
          items.length === 0
            ? { flexGrow: 1, paddingHorizontal: 20, paddingTop: GLASS_BAR_HEIGHT + 16 }
            : { paddingHorizontal: 20, paddingTop: GLASS_BAR_HEIGHT + 16, paddingBottom: 24 }
        }
        refreshControl={
          <ThemedRefreshControl refreshing={isFetching && !isFetchingNextPage} onRefresh={() => refetch()} />
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

      <GlassBar>
        <SelectFilterPill
          label={TRASH_RESOURCES[resource].label}
          title="Corbeille"
          options={resourceOptions}
          value={resource}
          onSelect={(value) => setSelectedResource(value as TrashResource)}
        />
        <GlassCapsule>
          <View className="h-11 justify-center px-4">
            <Text className="text-sm text-muted">
              {count} element{count > 1 ? "s" : ""}
            </Text>
          </View>
        </GlassCapsule>
      </GlassBar>
      </View>
    </SafeAreaView>
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

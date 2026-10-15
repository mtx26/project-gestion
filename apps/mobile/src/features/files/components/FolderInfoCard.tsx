import { formatDuration } from "@project-gestion/domain";
import type { Task, TimeEntryStats } from "@project-gestion/types";
import { ChevronDown, ChevronUp, Clock3, ListTodo } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { TaskStatusBadge } from "../../../components/badges/TaskStatusBadge";
import { formatMoney } from "../../../lib/money-format";
import { theme } from "../../../theme";

interface FolderInfoCardProps {
  folderName: string;
  tasks: Task[];
  isLoadingTasks: boolean;
  timeStats: TimeEntryStats | undefined;
  canViewTasks: boolean;
  canViewTime: boolean;
  onOpenTask: (task: Task) => void;
  onOpenTasks: () => void;
  onOpenTime: () => void;
}

const VISIBLE_TASKS = 5;

/** Ce que le dossier ouvert contient au-dela de ses fichiers : ses taches non
 * terminees et le temps qui lui est impute — equivalent natif du panneau lateral du
 * web, replie par defaut pour laisser la place au contenu du dossier. */
export function FolderInfoCard({
  folderName,
  tasks,
  isLoadingTasks,
  timeStats,
  canViewTasks,
  canViewTime,
  onOpenTask,
  onOpenTasks,
  onOpenTime,
}: FolderInfoCardProps) {
  const [expanded, setExpanded] = useState(false);

  if (!canViewTasks && !canViewTime) {
    return null;
  }

  const durationMinutes = timeStats?.duration_minutes ?? 0;
  const summary = [
    canViewTasks ? `${tasks.length} tache${tasks.length > 1 ? "s" : ""} en cours` : null,
    canViewTime ? formatDuration(durationMinutes) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <View className="gap-3 rounded-md border border-border bg-surface p-4">
      <Pressable
        onPress={() => setExpanded((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        className="flex-row items-center justify-between gap-2"
      >
        <View className="flex-1">
          <Text className="text-[11px] font-medium uppercase text-muted" numberOfLines={1}>
            {folderName}
          </Text>
          <Text className="mt-0.5 text-sm font-semibold text-foreground">{summary}</Text>
        </View>
        {expanded ? (
          <ChevronUp size={theme.iconSize.sm} color={theme.colors.muted} />
        ) : (
          <ChevronDown size={theme.iconSize.sm} color={theme.colors.muted} />
        )}
      </Pressable>

      {expanded ? (
        <View className="gap-4">
          {canViewTasks ? (
            <View className="gap-2 border-t border-border pt-3">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-1.5">
                  <ListTodo size={theme.iconSize.sm} color={theme.colors.muted} />
                  <Text className="text-sm font-medium text-foreground">Taches</Text>
                </View>
                <Pressable
                  onPress={onOpenTasks}
                  accessibilityRole="button"
                  hitSlop={8}
                  className="h-9 justify-center"
                >
                  <Text className="text-sm font-semibold text-primary">Ouvrir</Text>
                </Pressable>
              </View>
              {isLoadingTasks ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : tasks.length === 0 ? (
                <Text className="text-xs text-muted">Aucune tache liee.</Text>
              ) : (
                <View className="gap-1.5">
                  {tasks.slice(0, VISIBLE_TASKS).map((task) => (
                    <Pressable
                      key={task.id}
                      onPress={() => onOpenTask(task)}
                      accessibilityRole="button"
                      className="min-h-[44px] flex-row items-center justify-between gap-2 rounded-md bg-background px-3 py-2"
                    >
                      <Text className="flex-1 text-sm text-foreground" numberOfLines={1}>
                        {task.title}
                      </Text>
                      <TaskStatusBadge status={task.status} />
                    </Pressable>
                  ))}
                  {tasks.length > VISIBLE_TASKS ? (
                    <Text className="text-xs text-muted">+{tasks.length - VISIBLE_TASKS} autres</Text>
                  ) : null}
                </View>
              )}
            </View>
          ) : null}

          {canViewTime ? (
            <View className="gap-2 border-t border-border pt-3">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-1.5">
                  <Clock3 size={theme.iconSize.sm} color={theme.colors.muted} />
                  <Text className="text-sm font-medium text-foreground">Temps</Text>
                </View>
                <Pressable
                  onPress={onOpenTime}
                  accessibilityRole="button"
                  hitSlop={8}
                  className="h-9 justify-center"
                >
                  <Text className="text-sm font-semibold text-primary">Ouvrir</Text>
                </Pressable>
              </View>
              {durationMinutes === 0 ? (
                <Text className="text-xs text-muted">Aucune heure liee.</Text>
              ) : (
                <View className="gap-1.5">
                  <TotalRow label="Temps total" value={formatDuration(durationMinutes)} />
                  <TotalRow label="Montant total" value={formatMoney(timeStats?.cost_amount ?? 0)} />
                  <TotalRow label="Reste a payer" value={formatMoney(timeStats?.remaining_amount ?? 0)} />
                </View>
              )}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between gap-2">
      <Text className="text-xs text-muted">{label}</Text>
      <Text className="text-xs font-medium tabular-nums text-foreground">{value}</Text>
    </View>
  );
}

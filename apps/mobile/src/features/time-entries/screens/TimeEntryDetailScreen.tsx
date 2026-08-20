import {
  formatDuration,
  getEntryTarget,
  getEntryTargetLabel,
  getPaidRatio,
  getPaymentStatus,
} from "@project-gestion/domain";
import { permissionCodes } from "@project-gestion/permissions";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  CalendarDays,
  Clock,
  CreditCard,
  Folder,
  ListChecks,
  Pencil,
  Trash2,
  UserRound,
} from "lucide-react-native";
import type { ComponentType } from "react";
import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PaymentStatusBadge } from "../../../components/badges/PaymentStatusBadge";
import { DocumentList } from "../../../components/documents/DocumentList";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { formatDateTime } from "../../../lib/date-format";
import { getErrorMessage } from "../../../lib/errors";
import { formatMoney } from "../../../lib/money-format";
import { useOpenDocument } from "../../../lib/use-open-document";
import { theme } from "../../../theme";
import { useAuthStore } from "../../../stores/auth-store";
import { useProjectPermissions } from "../../projects/hooks/use-project-permissions";
import { useSelectedProject } from "../../projects/hooks/use-selected-project";
import { CorrectPaymentSheet } from "../components/CorrectPaymentSheet";
import { PaymentSheet } from "../components/PaymentSheet";
import {
  useCorrectTimeEntryPayment,
  useDeleteTimeEntry,
  usePayTimeEntry,
  useTimeEntry,
} from "../hooks/use-time-entries";

export function TimeEntryDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const timeEntryId = Number(id);
  const user = useAuthStore((state) => state.user);
  const { selectedProject } = useSelectedProject();
  const projectId = selectedProject?.id ?? null;
  const { can } = useProjectPermissions(selectedProject, user?.id ?? null);
  const canEdit = can(permissionCodes.timeEntryEdit);
  const canDelete = can(permissionCodes.timeEntryDelete);
  const canPay = can(permissionCodes.timeEntryPay);
  const canViewTasks = can(permissionCodes.taskView);
  const canViewFiles = can(permissionCodes.fileView);

  const { data: entry, isLoading, isError, error, refetch } = useTimeEntry(projectId, timeEntryId);
  const deleteTimeEntry = useDeleteTimeEntry(projectId);
  const payTimeEntry = usePayTimeEntry(projectId);
  const correctPayment = useCorrectTimeEntryPayment(projectId);
  const openDocument = useOpenDocument(projectId);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);

  function confirmDelete() {
    if (!entry) {
      return;
    }
    Alert.alert("Supprimer l'entree", "Supprimer definitivement cette entree de temps ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          await deleteTimeEntry.mutateAsync(entry.id);
          router.back();
        },
      },
    ]);
  }

  const paymentStatus = entry ? getPaymentStatus(entry) : null;
  const target = entry ? getEntryTarget(entry) : null;
  const TargetIcon = target?.type === "task" ? ListChecks : Folder;
  const targetPressable =
    target != null && (target.type === "task" ? canViewTasks : canViewFiles);
  const paidRatio = entry ? getPaidRatio(entry) : 100;

  function openTarget() {
    if (!target) {
      return;
    }
    if (target.type === "task") {
      router.push({ pathname: "/tasks/[id]", params: { id: String(target.id) } });
    } else {
      router.push("/files");
    }
  }

  return (
    // No "top" edge: the native header (back button + title + actions) already
    // sits above this screen and accounts for the status bar.
    <SafeAreaView className="flex-1 bg-background" edges={["bottom", "left", "right"]}>
      <Stack.Screen
        options={{
          title: entry?.title || "Detail du temps",
          // headerRight is always the same function (never undefined) so the native
          // header never has to remeasure between "no button" and "button" while
          // canEdit/canDelete resolve.
          headerRight: () => (
            <View className="flex-row items-center">
              {canDelete ? (
                <Pressable
                  onPress={confirmDelete}
                  accessibilityRole="button"
                  accessibilityLabel="Supprimer"
                  hitSlop={8}
                  className="h-11 w-11 items-center justify-center"
                >
                  <Trash2 size={theme.iconSize.sm} color={theme.colors.danger} />
                </Pressable>
              ) : null}
              {canEdit ? (
                <Pressable
                  onPress={() =>
                    entry && router.push({ pathname: "/time/[id]/edit", params: { id: String(entry.id) } })
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Modifier"
                  hitSlop={8}
                  className="mr-1 h-11 w-11 items-center justify-center"
                >
                  <Pencil size={theme.iconSize.sm} color={theme.colors.primary} />
                </Pressable>
              ) : null}
            </View>
          ),
        }}
      />

      {isLoading ? (
        <LoadingState />
      ) : isError || !entry || !paymentStatus ? (
        <View className="px-5 py-6">
          <ErrorState
            message={entry ? "Entree introuvable." : getErrorMessage(error)}
            onRetry={() => refetch()}
          />
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, gap: 16 }}>
          <View className="items-center gap-2 rounded-md border border-border bg-surface p-5">
            <PaymentStatusBadge status={paymentStatus} />
            {entry.title ? (
              <Text className="text-base font-semibold text-foreground">{entry.title}</Text>
            ) : null}
            <Text className="text-3xl font-bold tabular-nums text-foreground">
              {formatMoney(entry.cost_amount)}
            </Text>
            <View className="flex-row items-center gap-2">
              <Clock size={12} color={theme.colors.muted} />
              <Text className="text-sm text-muted">
                {formatDuration(entry.duration_minutes)} · {formatMoney(entry.hourly_rate)}/h
              </Text>
            </View>
          </View>

          {/* "Payer" disparait une fois l'entree soldee, "Corriger" n'apparait qu'a partir
              du premier paiement : les deux ne sont jamais absents en meme temps. */}
          {canPay ? (
            <View className="flex-row gap-2">
              {paymentStatus !== "paid" ? (
                <Pressable
                  onPress={() => setPaymentOpen(true)}
                  accessibilityRole="button"
                  className="h-11 flex-1 flex-row items-center justify-center gap-2 rounded-md bg-primary"
                >
                  <CreditCard size={theme.iconSize.sm} color={theme.colors.primaryForeground} />
                  <Text className="text-sm font-semibold text-primaryForeground">Payer</Text>
                </Pressable>
              ) : null}
              {paymentStatus !== "unpaid" ? (
                <Pressable
                  onPress={() => setCorrectionOpen(true)}
                  accessibilityRole="button"
                  className="h-11 flex-1 flex-row items-center justify-center gap-2 rounded-md border border-border bg-surface"
                >
                  <Pencil size={theme.iconSize.sm} color={theme.colors.foreground} />
                  <Text className="text-sm font-medium text-foreground">Corriger</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <View className="gap-3 rounded-md border border-border bg-surface p-4">
            <DetailRow
              icon={UserRound}
              label="Utilisateur"
              value={entry.user_display_name ?? "Non attribue"}
            />
            <DetailRow icon={CalendarDays} label="Date" value={formatDateTime(entry.start_date)} />
            {target ? (
              <Pressable
                onPress={targetPressable ? openTarget : undefined}
                disabled={!targetPressable}
                accessibilityRole={targetPressable ? "button" : undefined}
                className="flex-row items-center gap-3"
              >
                <TargetIcon size={theme.iconSize.sm} color={theme.colors.muted} />
                <Text className="w-28 text-sm text-muted">Cible</Text>
                <Text
                  className={`flex-1 text-sm font-medium ${targetPressable ? "text-primary" : "text-foreground"}`}
                  numberOfLines={1}
                >
                  {getEntryTargetLabel(entry)}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {entry.description ? (
            <View className="gap-1.5">
              <Text className="text-sm font-medium text-foreground">Description</Text>
              <Text className="text-sm leading-relaxed text-muted">{entry.description}</Text>
            </View>
          ) : null}

          <View className="gap-3">
            <Text className="text-sm font-medium text-foreground">Paiement</Text>
            <View className="flex-row items-center gap-3">
              <View className="h-2 flex-1 overflow-hidden rounded-full bg-border">
                <View className="h-2 rounded-full bg-primary" style={{ width: `${paidRatio}%` }} />
              </View>
              <Text className="text-sm font-semibold tabular-nums text-foreground">
                {Math.round(paidRatio)}%
              </Text>
            </View>
            <View className="flex-row gap-2">
              <View className="flex-1 rounded-md border border-border bg-surface p-3">
                <Text className="text-xs text-muted">Paye</Text>
                <Text className="mt-1 text-base font-semibold tabular-nums text-foreground">
                  {formatMoney(entry.paid_amount)}
                </Text>
              </View>
              <View className="flex-1 rounded-md border border-border bg-surface p-3">
                <Text className="text-xs text-muted">Reste</Text>
                <Text className="mt-1 text-base font-semibold tabular-nums text-foreground">
                  {paymentStatus === "paid" ? "—" : formatMoney(entry.remaining_amount)}
                </Text>
              </View>
            </View>
          </View>

          <DocumentList
            documents={entry.documents_info ?? []}
            isOpening={openDocument.isPending}
            onOpen={(documentId) => openDocument.mutate(documentId)}
          />

          {openDocument.error ? <ErrorState message={getErrorMessage(openDocument.error)} /> : null}
        </ScrollView>
      )}

      <PaymentSheet
        // Une instance par entree : le schema est borne par son reste a payer.
        key={`payment-${entry?.id ?? "none"}-${entry?.remaining_amount ?? "0"}`}
        entry={paymentOpen ? (entry ?? null) : null}
        isPending={payTimeEntry.isPending}
        error={payTimeEntry.error}
        onClose={() => {
          setPaymentOpen(false);
          payTimeEntry.reset();
        }}
        onSubmit={(values) =>
          entry &&
          payTimeEntry.mutate(
            { id: entry.id, mode: values.mode, amount: values.amount },
            { onSuccess: () => setPaymentOpen(false) },
          )
        }
      />

      <CorrectPaymentSheet
        key={`correction-${entry?.id ?? "none"}-${entry?.paid_amount ?? "0"}`}
        entry={correctionOpen ? (entry ?? null) : null}
        isPending={correctPayment.isPending}
        error={correctPayment.error}
        onClose={() => {
          setCorrectionOpen(false);
          correctPayment.reset();
        }}
        onSubmit={(amount) =>
          entry &&
          correctPayment.mutate({ id: entry.id, amount }, { onSuccess: () => setCorrectionOpen(false) })
        }
      />
    </SafeAreaView>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ size?: number; color?: string }>;
  label: string;
  value: string;
}) {
  return (
    <View className="flex-row items-center gap-3">
      <Icon size={theme.iconSize.sm} color={theme.colors.muted} />
      <Text className="w-28 text-sm text-muted">{label}</Text>
      <Text className="flex-1 text-sm font-medium text-foreground" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

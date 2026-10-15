import { zodResolver } from "@hookform/resolvers/zod";
import {
  findTargetLabel,
  formatDuration,
  getDurationMinutes,
  getTargetPayload,
  getTargetValueFromEntry,
} from "@project-gestion/domain";
import type { TimeEntry } from "@project-gestion/types";
import {
  timeEntryFieldMap,
  timeEntrySchema,
  type TimeEntryFormInput,
  type TimeEntryFormValues,
} from "@project-gestion/validation";
import { useRouter } from "expo-router";
import { ChevronDown } from "lucide-react-native";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DocumentAttachmentField } from "../../../components/documents/DocumentAttachmentField";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { FormScreen } from "../../../components/layout/FormScreen";
import { TargetPickerModal } from "../../../components/pickers/TargetPickerModal";
import { DateTimeField } from "../../../components/ui/DateTimeField";
import { FormField } from "../../../components/ui/FormField";
import { InlineMessage } from "../../../components/ui/InlineMessage";
import { PickerFieldBody } from "../../../components/forms/PickerField";
import { SelectMenu } from "../../../components/menus/SelectMenu";
import { getErrorMessage } from "../../../lib/errors";
import { formatMoney } from "../../../lib/money-format";
import { useDocumentAttachment } from "../../../lib/use-document-attachment";
import { useServerFieldErrors } from "../../../lib/use-server-field-errors";
import { theme } from "../../../theme";
import { useAuthStore } from "../../../stores/auth-store";
import { useProjectMembers, useProjectTargetTree } from "../../projects/hooks/use-project-resources";
import { useSelectedProject } from "../../projects/hooks/use-selected-project";
import { useCreateTimeEntry, useTimeEntry, useUpdateTimeEntry } from "../hooks/use-time-entries";

interface TimeEntryFormScreenProps {
  mode: "create" | "edit";
  timeEntryId?: number;
}

export function TimeEntryFormScreen({ mode, timeEntryId }: TimeEntryFormScreenProps) {
  const { selectedProject } = useSelectedProject();
  const projectId = selectedProject?.id ?? null;
  const entryQuery = useTimeEntry(projectId, mode === "edit" ? (timeEntryId ?? null) : null);

  if (mode === "edit" && (entryQuery.isLoading || !entryQuery.data)) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <LoadingState />
      </SafeAreaView>
    );
  }

  return (
    <TimeEntryFormBody
      mode={mode}
      projectId={projectId}
      entry={mode === "edit" ? (entryQuery.data ?? null) : null}
    />
  );
}

function TimeEntryFormBody({
  mode,
  projectId,
  entry,
}: {
  mode: "create" | "edit";
  projectId: number | null;
  entry: TimeEntry | null;
}) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [rawError, setRawError] = useState<unknown>(null);
  const [targetValue, setTargetValue] = useState(entry ? getTargetValueFromEntry(entry) : "project");
  const [targetPickerOpen, setTargetPickerOpen] = useState(false);
  // Une entree orpheline (compte supprime) n'a plus de titulaire : on peut lui en donner
  // un. Une entree deja attribuee n'est pas reattribuable — ses heures ont pu etre payees
  // a quelqu'un (refuse aussi cote serveur, `errors.time_entry.user_already_assigned`).
  const isOrphanEntry = mode === "edit" && entry != null && entry.user == null;
  const [assignedUserId, setAssignedUserId] = useState<number | null>(null);

  const createTimeEntry = useCreateTimeEntry(projectId);
  const updateTimeEntry = useUpdateTimeEntry(projectId);
  const { tree } = useProjectTargetTree(projectId);
  const { members } = useProjectMembers(isOrphanEntry ? projectId : null);
  const docs = useDocumentAttachment(entry?.documents_info ?? []);

  const startIso = entry ? entry.start_date : new Date().toISOString();
  const endIso = entry
    ? new Date(new Date(entry.start_date).getTime() + entry.duration_minutes * 60000).toISOString()
    : startIso;

  const form = useForm<TimeEntryFormInput, unknown, TimeEntryFormValues>({
    resolver: zodResolver(timeEntrySchema),
    defaultValues: {
      title: entry?.title ?? "",
      startDate: startIso,
      endDate: endIso,
      hourlyRate: entry?.hourly_rate ?? user?.profile?.default_hourly_rate ?? "0",
      description: entry?.description ?? "",
    },
  });

  useServerFieldErrors(form, rawError, timeEntryFieldMap);

  const [startDate, endDate, hourlyRate] = form.watch(["startDate", "endDate", "hourlyRate"]);
  const durationMinutes = getDurationMinutes(startDate, endDate);
  const computedTotal = (durationMinutes / 60) * Number(hourlyRate || 0);

  async function onSubmit(values: TimeEntryFormValues) {
    if (!projectId || !user) {
      return;
    }
    setRawError(null);
    const { folder, task } = getTargetPayload(targetValue);
    // Les fichiers choisis sont envoyes ici, dans le dossier de la cible : l'entree ne
    // reference que des documents deja crees.
    const documentIds = await docs.resolveDocumentIds(projectId, folder);
    if (documentIds === null) {
      return;
    }
    try {
      if (mode === "create") {
        await createTimeEntry.mutateAsync({
          user: user.id,
          title: values.title,
          start_date: values.startDate,
          duration_minutes: durationMinutes,
          hourly_rate: values.hourlyRate,
          description: values.description,
          folder,
          task,
          documents: documentIds,
        });
      } else if (entry) {
        await updateTimeEntry.mutateAsync({
          id: entry.id,
          payload: {
            title: values.title,
            start_date: values.startDate,
            duration_minutes: durationMinutes,
            hourly_rate: values.hourlyRate,
            description: values.description,
            folder,
            task,
            documents: documentIds,
            ...(isOrphanEntry && assignedUserId != null ? { user: assignedUserId } : {}),
          },
        });
      }
      router.back();
    } catch (caught) {
      setRawError(caught);
    }
  }

  const isSubmitting = docs.uploading || createTimeEntry.isPending || updateTimeEntry.isPending;
  const targetLabel = findTargetLabel(tree, targetValue) ?? "Projet";
  const assignedUserLabel =
    assignedUserId == null
      ? "Choisir un membre"
      : (members.find((member) => member.user === assignedUserId)?.user_display_name ?? "Membre");

  return (
    <FormScreen
      title={mode === "create" ? "Nouvelle entree" : "Modifier l'entree"}
      submitLabel={mode === "create" ? "Creer" : "Enregistrer"}
      submitDisabled={isSubmitting || durationMinutes <= 0}
      onCancel={() => router.back()}
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <InlineMessage variant="danger">{docs.uploadError ?? getErrorMessage(rawError)}</InlineMessage>

      <Controller
        control={form.control}
        name="title"
        render={({ field, fieldState }) => (
          <FormField
            label="Titre"
            value={field.value}
            onChangeText={field.onChange}
            error={fieldState.error?.message}
            placeholder="Titre de la tache liee si vide"
            autoCapitalize="sentences"
            returnKeyType="next"
          />
        )}
      />

      <Controller
        control={form.control}
        name="startDate"
        render={({ field, fieldState }) => (
          <DateTimeField
            label="Debut"
            value={field.value}
            onChange={field.onChange}
            error={fieldState.error?.message}
          />
        )}
      />

      <Controller
        control={form.control}
        name="endDate"
        render={({ field, fieldState }) => (
          <DateTimeField
            label="Fin"
            value={field.value}
            onChange={field.onChange}
            error={fieldState.error?.message}
          />
        )}
      />

      {isOrphanEntry ? (
        <View className="gap-2">
          <Text className="text-sm font-medium text-foreground">Attribuer a</Text>
          <SelectMenu
            title="Attribuer a"
            options={members.map((member) => ({
              label: member.user_display_name,
              value: String(member.user),
            }))}
            value={assignedUserId == null ? undefined : String(assignedUserId)}
            onSelect={(value) => setAssignedUserId(Number(value))}
          >
            <PickerFieldBody value={assignedUserLabel} />
          </SelectMenu>
          <Text className="text-xs text-muted">
            Cette entree n&apos;a plus de titulaire (compte supprime) : ses heures ne sont comptees pour
            personne et ne peuvent etre payees a personne. Les paiements deja enregistres suivent
            l&apos;entree.
          </Text>
        </View>
      ) : null}

      <Controller
        control={form.control}
        name="hourlyRate"
        render={({ field, fieldState }) => (
          <FormField
            label="Taux horaire (EUR/h)"
            value={field.value}
            onChangeText={field.onChange}
            error={fieldState.error?.message}
            keyboardType="decimal-pad"
            returnKeyType="next"
          />
        )}
      />

      <Text className="text-sm text-muted">
        {formatDuration(durationMinutes)} · {formatMoney(computedTotal)}
      </Text>

      <Controller
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormField
            label="Description"
            value={field.value ?? ""}
            onChangeText={field.onChange}
            autoCapitalize="sentences"
            multiline
            numberOfLines={3}
            returnKeyType="done"
          />
        )}
      />

      <View className="gap-2">
        <Text className="text-sm font-medium text-foreground">Cible</Text>
        <Pressable
          onPress={() => setTargetPickerOpen(true)}
          accessibilityRole="button"
          className="h-11 min-h-[44px] flex-row items-center justify-between rounded-md border border-border bg-surface px-3"
        >
          <Text className="flex-1 text-base text-foreground" numberOfLines={1} ellipsizeMode="tail">
            {targetLabel}
          </Text>
          <ChevronDown size={theme.iconSize.sm} color={theme.colors.muted} />
        </Pressable>
        <TargetPickerModal
          visible={targetPickerOpen}
          tree={tree}
          value={targetValue}
          onChange={setTargetValue}
          onClose={() => setTargetPickerOpen(false)}
        />
      </View>

      <DocumentAttachmentField
        existingDocs={docs.existingDocs}
        pendingFiles={docs.pendingFiles}
        uploading={docs.uploading}
        onRemoveDoc={docs.removeExistingDoc}
        onAddFiles={docs.addPendingFiles}
        onRemoveFile={docs.removePendingFile}
      />
    </FormScreen>
  );
}

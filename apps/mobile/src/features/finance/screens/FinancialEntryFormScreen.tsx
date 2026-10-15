import { zodResolver } from "@hookform/resolvers/zod";
import {
  findTargetLabel,
  getTargetPayload,
  getTargetValueFromEntry,
  toIsoDateString,
} from "@project-gestion/domain";
import type { FinancialEntry } from "@project-gestion/types";
import { financeSchema, type FinanceFormInput, type FinanceFormValues } from "@project-gestion/validation";
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
import { SegmentedControl } from "../../../components/ui/SegmentedControl";
import { getErrorMessage } from "../../../lib/errors";
import { useDocumentAttachment } from "../../../lib/use-document-attachment";
import { useServerFieldErrors } from "../../../lib/use-server-field-errors";
import { theme } from "../../../theme";
import { useProjectTargetTree } from "../../projects/hooks/use-project-resources";
import { useSelectedProject } from "../../projects/hooks/use-selected-project";
import {
  useCreateFinancialEntry,
  useFinancialEntry,
  useUpdateFinancialEntry,
} from "../hooks/use-financial-entries";

interface FinancialEntryFormScreenProps {
  mode: "create" | "edit";
  entryId?: number;
}

export function FinancialEntryFormScreen({ mode, entryId }: FinancialEntryFormScreenProps) {
  const { selectedProject } = useSelectedProject();
  const projectId = selectedProject?.id ?? null;
  const entryQuery = useFinancialEntry(projectId, mode === "edit" ? (entryId ?? null) : null);

  if (mode === "edit" && (entryQuery.isLoading || !entryQuery.data)) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <LoadingState />
      </SafeAreaView>
    );
  }

  return (
    <FinancialEntryFormBody
      mode={mode}
      projectId={projectId}
      entry={mode === "edit" ? (entryQuery.data ?? null) : null}
    />
  );
}

/** L'API attend un jour nu ("YYYY-MM-DD") alors que le selecteur natif parle en Date :
 * on ancre la conversion a midi local, pour qu'aucun decalage de fuseau ne fasse
 * changer de jour au passage. */
function toPickerValue(dateOnly: string | null): string {
  const date = dateOnly ? new Date(`${dateOnly}T12:00:00`) : new Date();
  return date.toISOString();
}

function FinancialEntryFormBody({
  mode,
  projectId,
  entry,
}: {
  mode: "create" | "edit";
  projectId: number | null;
  entry: FinancialEntry | null;
}) {
  const router = useRouter();
  const [rawError, setRawError] = useState<unknown>(null);
  const [targetValue, setTargetValue] = useState(entry ? getTargetValueFromEntry(entry) : "project");
  const [targetPickerOpen, setTargetPickerOpen] = useState(false);

  const createEntry = useCreateFinancialEntry(projectId);
  const updateEntry = useUpdateFinancialEntry(projectId);
  const { tree } = useProjectTargetTree(projectId);
  const docs = useDocumentAttachment(entry?.documents_info ?? []);

  const form = useForm<FinanceFormInput, unknown, FinanceFormValues>({
    resolver: zodResolver(financeSchema),
    defaultValues: {
      type: entry?.type ?? "expense",
      amount: String(entry?.amount ?? ""),
      date: entry?.date ?? toIsoDateString(new Date()),
      description: entry?.description ?? "",
    },
  });

  useServerFieldErrors(form, rawError, ["type", "amount", "date", "description"]);

  async function onSubmit(values: FinanceFormValues) {
    if (!projectId) {
      return;
    }
    setRawError(null);
    const { folder, task } = getTargetPayload(targetValue);
    // Les fichiers choisis sont envoyes ici, dans le dossier de la cible : l'ecriture
    // ne reference que des documents deja crees.
    const documentIds = await docs.resolveDocumentIds(projectId, folder);
    if (documentIds === null) {
      return;
    }
    try {
      const payload = { ...values, folder, task, documents: documentIds };
      if (mode === "create") {
        await createEntry.mutateAsync(payload);
      } else if (entry) {
        await updateEntry.mutateAsync({ id: entry.id, payload });
      }
      router.back();
    } catch (caught) {
      setRawError(caught);
    }
  }

  const isSubmitting = docs.uploading || createEntry.isPending || updateEntry.isPending;
  const targetLabel = findTargetLabel(tree, targetValue) ?? "Projet";

  return (
    <FormScreen
      title={mode === "create" ? "Nouvelle entree" : "Modifier l'entree"}
      submitLabel={mode === "create" ? "Creer" : "Enregistrer"}
      submitDisabled={isSubmitting}
      onCancel={() => router.back()}
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <InlineMessage variant="danger">{docs.uploadError ?? getErrorMessage(rawError)}</InlineMessage>

      <View className="gap-2">
        <Text className="text-sm font-medium text-foreground">Type</Text>
        <Controller
          control={form.control}
          name="type"
          render={({ field }) => (
            <SegmentedControl
              accessibilityLabel="Type d'entree"
              options={[
                { label: "Depense", value: "expense" },
                { label: "Remboursement", value: "refund" },
              ]}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </View>

      <Controller
        control={form.control}
        name="amount"
        render={({ field, fieldState }) => (
          <FormField
            label="Montant (EUR)"
            value={field.value}
            onChangeText={field.onChange}
            error={fieldState.error?.message}
            keyboardType="decimal-pad"
            returnKeyType="next"
          />
        )}
      />

      <Controller
        control={form.control}
        name="date"
        render={({ field, fieldState }) => (
          <DateTimeField
            label="Date"
            mode="date"
            value={toPickerValue(field.value)}
            onChange={(iso) => field.onChange(toIsoDateString(new Date(iso)))}
            error={fieldState.error?.message}
          />
        )}
      />

      <Controller
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormField
            label="Description"
            value={field.value ?? ""}
            onChangeText={field.onChange}
            placeholder="Details optionnels"
            autoCapitalize="sentences"
            multiline
            numberOfLines={3}
            returnKeyType="done"
          />
        )}
      />

      <View className="gap-2">
        <Text className="text-sm font-medium text-foreground">Cible (optionnel)</Text>
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

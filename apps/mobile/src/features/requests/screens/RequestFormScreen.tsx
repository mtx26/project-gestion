import { zodResolver } from "@hookform/resolvers/zod";
import type { ExpenseRequest } from "@project-gestion/types";
import { requestFieldMap, requestSchema, type RequestFormInput, type RequestFormValues } from "@project-gestion/validation";
import { useRouter } from "expo-router";
import { ChevronDown } from "lucide-react-native";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FolderPickerModal } from "../../../components/pickers/FolderPickerModal";
import { FormScreen } from "../../../components/layout/FormScreen";
import { InlineMessage } from "../../../components/ui/InlineMessage";
import { FormField } from "../../../components/ui/FormField";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { getErrorMessage } from "../../../lib/errors";
import { findFolderName } from "../../../lib/folder-tree";
import { useServerFieldErrors } from "../../../lib/use-server-field-errors";
import { theme } from "../../../theme";
import { useProjectFolders } from "../../projects/hooks/use-project-resources";
import { useSelectedProject } from "../../projects/hooks/use-selected-project";
import { useCreateRequest, useRequest, useUpdateRequest } from "../hooks/use-requests";

interface RequestFormScreenProps {
  mode: "create" | "edit";
  requestId?: number;
}

export function RequestFormScreen({ mode, requestId }: RequestFormScreenProps) {
  const { selectedProject } = useSelectedProject();
  const projectId = selectedProject?.id ?? null;
  const requestQuery = useRequest(projectId, mode === "edit" ? (requestId ?? null) : null);

  if (mode === "edit" && (requestQuery.isLoading || !requestQuery.data)) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <LoadingState />
      </SafeAreaView>
    );
  }

  return (
    <RequestFormBody
      mode={mode}
      projectId={projectId}
      request={mode === "edit" ? (requestQuery.data ?? null) : null}
    />
  );
}

function RequestFormBody({
  mode,
  projectId,
  request,
}: {
  mode: "create" | "edit";
  projectId: number | null;
  request: ExpenseRequest | null;
}) {
  const router = useRouter();
  const [rawError, setRawError] = useState<unknown>(null);
  const [folderId, setFolderId] = useState<number | null>(request?.folder ?? null);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const createRequest = useCreateRequest(projectId);
  const updateRequest = useUpdateRequest(projectId);
  const { folders } = useProjectFolders(projectId);

  const form = useForm<RequestFormInput, unknown, RequestFormValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      title: request?.title ?? "",
      amount: String(request?.amount ?? ""),
      category: request?.category ?? "",
      description: request?.description ?? "",
    },
  });

  useServerFieldErrors(form, rawError, requestFieldMap);

  async function onSubmit(values: RequestFormValues) {
    setRawError(null);
    try {
      if (mode === "create") {
        await createRequest.mutateAsync({
          title: values.title,
          amount: values.amount,
          category: values.category,
          description: values.description,
          folder: folderId,
        });
      } else if (request) {
        await updateRequest.mutateAsync({
          id: request.id,
          payload: {
            title: values.title,
            amount: values.amount,
            category: values.category,
            description: values.description,
            folder: folderId,
          },
        });
      }
      router.back();
    } catch (caught) {
      setRawError(caught);
    }
  }

  const isSubmitting = createRequest.isPending || updateRequest.isPending;

  return (
    <FormScreen
      title={mode === "create" ? "Nouvelle demande" : "Modifier la demande"}
      submitLabel={mode === "create" ? "Creer" : "Enregistrer"}
      submitDisabled={isSubmitting}
      onCancel={() => router.back()}
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <InlineMessage variant="danger">{getErrorMessage(rawError)}</InlineMessage>
      <Controller
        control={form.control}
        name="title"
        render={({ field, fieldState }) => (
          <FormField
            label="Titre"
            value={field.value}
            onChangeText={field.onChange}
            error={fieldState.error?.message}
            autoCapitalize="sentences"
            returnKeyType="next"
          />
        )}
      />

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
        name="category"
        render={({ field }) => (
          <FormField
            label="Categorie"
            value={field.value ?? ""}
            onChangeText={field.onChange}
            autoCapitalize="sentences"
            returnKeyType="next"
          />
        )}
      />

      <View className="gap-2">
        <Text className="text-sm font-medium text-foreground">Dossier</Text>
        <Pressable
          onPress={() => setFolderPickerOpen(true)}
          accessibilityRole="button"
          className="h-11 min-h-[44px] flex-row items-center justify-between rounded-md border border-border bg-surface px-3"
        >
          <Text className="flex-1 text-base text-foreground" numberOfLines={1} ellipsizeMode="tail">
            {folderId == null ? "Projet (racine)" : (findFolderName(folders, folderId) ?? "Dossier")}
          </Text>
          <ChevronDown size={theme.iconSize.sm} color={theme.colors.muted} />
        </Pressable>
        <FolderPickerModal
          visible={folderPickerOpen}
          folders={folders}
          selectedFolderId={folderId}
          onSelect={setFolderId}
          onClose={() => setFolderPickerOpen(false)}
        />
      </View>

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
    </FormScreen>
  );
}

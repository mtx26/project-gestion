import { zodResolver } from "@hookform/resolvers/zod";
import { permissionCodes } from "@project-gestion/permissions";
import type { Invitation, ProjectMember, Role } from "@project-gestion/types";
import { inviteMemberSchema, normalizeAmountInput, type InviteMemberFormValues } from "@project-gestion/validation";
import { Stack } from "expo-router";
import { MailPlus } from "lucide-react-native";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { FilterPill } from "../../../components/filters/FilterPill";
import { NameSheet } from "../../../components/layout/NameSheet";
import { Button } from "../../../components/ui/Button";
import { FormField } from "../../../components/ui/FormField";
import { InlineMessage } from "../../../components/ui/InlineMessage";
import { getErrorMessage } from "../../../lib/errors";
import { useServerFieldErrors } from "../../../lib/use-server-field-errors";
import { useActionSheet } from "../../../providers/ActionSheetProvider";
import { theme } from "../../../theme";
import { useAuthStore } from "../../../stores/auth-store";
import { useProjectPermissions } from "../../projects/hooks/use-project-permissions";
import { useProjectMembers } from "../../projects/hooks/use-project-resources";
import { useSelectedProject } from "../../projects/hooks/use-selected-project";
import { MemberCard } from "../components/MemberCard";
import {
  OWNER_MEMBER_ID,
  useCancelInvitation,
  useInviteMember,
  useProjectInvitations,
  useRemoveMember,
  useUpdateInvitationRole,
  useUpdateMemberRate,
  useUpdateMemberRole,
} from "../hooks/use-project-members";
import { useProjectRoles } from "../hooks/use-project-roles";

export function MembersScreen() {
  const user = useAuthStore((state) => state.user);
  const showActionSheet = useActionSheet();
  const { selectedProject, isLoading } = useSelectedProject();
  const projectId = selectedProject?.id ?? null;
  const { can } = useProjectPermissions(selectedProject, user?.id ?? null);
  const canManageMembers = can(permissionCodes.memberEdit);
  const canEditRates = can(permissionCodes.memberEditRates);
  const canEditOwnRate = can(permissionCodes.memberEditOwnRate);

  const { members, isLoading: isLoadingMembers } = useProjectMembers(projectId);
  const { invitations } = useProjectInvitations(projectId, canManageMembers);
  const { roles } = useProjectRoles(projectId);

  const inviteMember = useInviteMember(projectId);
  const updateMemberRole = useUpdateMemberRole(projectId);
  const updateMemberRate = useUpdateMemberRate(projectId);
  const removeMember = useRemoveMember(projectId);
  const updateInvitationRole = useUpdateInvitationRole(projectId);
  const cancelInvitation = useCancelInvitation(projectId);

  const [rateTarget, setRateTarget] = useState<ProjectMember | null>(null);

  function pickRole(title: string, onSelect: (roleId: number) => void, currentRoleId?: number) {
    showActionSheet(
      title,
      roles.map((role: Role) => ({ label: role.name, value: String(role.id) })),
      (value) => onSelect(Number(value)),
      currentRoleId == null ? undefined : String(currentRoleId),
    );
  }

  function canEditRateOf(member: ProjectMember) {
    const isOwnRow = member.user === user?.id;
    return member.id === OWNER_MEMBER_ID ? isOwnRow : canEditRates || (canEditOwnRate && isOwnRow);
  }

  function openMemberActions(member: ProjectMember) {
    const isOwnerEntry = member.id === OWNER_MEMBER_ID;
    const options = [
      ...(canManageMembers && !isOwnerEntry ? [{ label: "Changer de role", value: "role" }] : []),
      ...(canEditRateOf(member) ? [{ label: "Modifier le taux horaire", value: "rate" }] : []),
      ...(canManageMembers && !isOwnerEntry
        ? [{ label: "Retirer du projet", value: "remove", destructive: true }]
        : []),
    ];
    if (options.length === 0) {
      return;
    }

    showActionSheet(member.user_display_name, options, (value) => {
      if (value === "role") {
        pickRole(
          `Role de ${member.user_display_name}`,
          (roleId) => updateMemberRole.mutate({ memberId: member.id, roleId }),
          member.role_deleted ? undefined : member.role,
        );
      } else if (value === "rate") {
        setRateTarget(member);
      } else if (value === "remove") {
        Alert.alert(
          `Retirer ${member.user_display_name} ?`,
          "Ce membre perdra immediatement l'acces au projet.",
          [
            { text: "Annuler", style: "cancel" },
            { text: "Retirer", style: "destructive", onPress: () => removeMember.mutate(member.id) },
          ],
        );
      }
    });
  }

  function openInvitationActions(invitation: Invitation) {
    showActionSheet(
      invitation.email,
      [
        { label: "Changer de role", value: "role" },
        { label: "Annuler l'invitation", value: "cancel", destructive: true },
      ],
      (value) => {
        if (value === "role") {
          pickRole(
            `Role de ${invitation.email}`,
            (roleId) => updateInvitationRole.mutate({ invitationId: invitation.id, roleId }),
            invitation.role,
          );
        } else {
          Alert.alert(
            `Annuler l'invitation de ${invitation.email} ?`,
            "Cette personne ne pourra plus rejoindre le projet avec ce lien.",
            [
              { text: "Annuler", style: "cancel" },
              {
                text: "Confirmer",
                style: "destructive",
                onPress: () => cancelInvitation.mutate(invitation.id),
              },
            ],
          );
        }
      },
    );
  }

  const actionError =
    updateMemberRole.error ??
    updateMemberRate.error ??
    removeMember.error ??
    updateInvitationRole.error ??
    cancelInvitation.error;

  return (
    // No "top" edge: the native header already sits above this screen.
    <SafeAreaView className="flex-1 bg-background" edges={["bottom", "left", "right"]}>
      <Stack.Screen options={{ title: "Membres" }} />

      {isLoading || isLoadingMembers ? (
        <LoadingState />
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, gap: 16 }}>
          {canManageMembers ? (
            <InviteForm
              roles={roles}
              isPending={inviteMember.isPending}
              error={inviteMember.error}
              onPickRole={(onSelect, currentRoleId) => pickRole("Role de l'invite", onSelect, currentRoleId)}
              onSubmit={(values) =>
                inviteMember.mutate({ email: values.email, roleId: Number(values.roleId) })
              }
            />
          ) : null}

          {actionError ? <ErrorState message={getErrorMessage(actionError)} /> : null}

          <View className="gap-2">
            <Text className="text-[11px] font-medium uppercase text-muted">
              Membres ({members.length})
            </Text>
            {members.map((member) => (
              <MemberCard
                key={member.id}
                member={member}
                hasActions={canManageMembers || canEditRateOf(member)}
                onLongPress={() => openMemberActions(member)}
              />
            ))}
          </View>

          {canManageMembers && invitations.length > 0 ? (
            <View className="gap-2">
              <Text className="text-[11px] font-medium uppercase text-muted">
                Invitations ({invitations.length})
              </Text>
              {invitations.map((invitation) => (
                <Pressable
                  key={invitation.id}
                  onLongPress={() => openInvitationActions(invitation)}
                  accessibilityRole="button"
                  accessibilityHint="Appui long pour les actions"
                  className="gap-1 rounded-md border border-border bg-background p-4"
                >
                  <Text className="text-base font-medium text-foreground" numberOfLines={1}>
                    {invitation.email}
                  </Text>
                  <Text className="text-xs text-muted">
                    {invitation.role_name} · {invitation.status}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </ScrollView>
      )}

      <NameSheet
        visible={rateTarget != null}
        title="Taux horaire"
        label="Taux horaire (EUR/h)"
        initialValue={rateTarget?.hourly_rate ?? ""}
        submitLabel="Enregistrer"
        isPending={updateMemberRate.isPending}
        error={getErrorMessage(updateMemberRate.error)}
        onSubmit={(value) =>
          rateTarget &&
          updateMemberRate.mutate(
            { memberId: rateTarget.id, rate: normalizeAmountInput(value) },
            { onSuccess: () => setRateTarget(null) },
          )
        }
        onClose={() => {
          setRateTarget(null);
          updateMemberRate.reset();
        }}
      />
    </SafeAreaView>
  );
}

function InviteForm({
  roles,
  isPending,
  error,
  onPickRole,
  onSubmit,
}: {
  roles: Role[];
  isPending: boolean;
  error: unknown;
  onPickRole: (onSelect: (roleId: number) => void, currentRoleId?: number) => void;
  onSubmit: (values: InviteMemberFormValues) => void;
}) {
  const form = useForm<InviteMemberFormValues>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { email: "", roleId: "" },
  });

  useServerFieldErrors(form, error, ["email", { name: "roleId", serverField: "role" }]);

  const roleId = form.watch("roleId");
  const roleLabel = roles.find((role) => String(role.id) === roleId)?.name ?? "Choisir un role";

  return (
    <View className="gap-3 rounded-md border border-border bg-surface p-4">
      <View className="flex-row items-center gap-2">
        <MailPlus size={theme.iconSize.sm} color={theme.colors.primary} />
        <Text className="text-sm font-semibold text-foreground">Inviter un membre</Text>
      </View>

      <InlineMessage variant="danger">{getErrorMessage(error)}</InlineMessage>

      <Controller
        control={form.control}
        name="email"
        render={({ field, fieldState }) => (
          <FormField
            label="Email"
            value={field.value}
            onChangeText={field.onChange}
            error={fieldState.error?.message}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />
        )}
      />

      <View className="gap-2">
        <Text className="text-sm font-medium text-foreground">Role</Text>
        <FilterPill
          label={roleLabel}
          onPress={() =>
            onPickRole((selectedRoleId) =>
              form.setValue("roleId", String(selectedRoleId), { shouldValidate: true }),
            )
          }
        />
        {form.formState.errors.roleId ? (
          <Text className="text-sm text-danger">{form.formState.errors.roleId.message}</Text>
        ) : null}
      </View>

      <Button
        onPress={form.handleSubmit((values) => {
          onSubmit(values);
          form.reset();
        })}
        disabled={isPending}
      >
        {isPending ? "Envoi..." : "Inviter"}
      </Button>
    </View>
  );
}

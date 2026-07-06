"use client";

import type { Project, ProjectMember, Role } from "@project-gestion/types";
import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@project-gestion/query-keys";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Trash2, Users } from "lucide-react";
import { useState } from "react";
import { normalizeApiList } from "@project-gestion/api";
import { ConfirmDeleteDialog } from "@/components/dialogs/confirm-delete-dialog";
import { FormError } from "@/components/forms/form-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InvitationStatusBadge } from "@/components/badges/invitation-status-badge";
import { MemberTypeBadge } from "@/components/badges/member-type-badge";
import { MoneyInput } from "@/components/forms/money-input";
import { MutedInfoCard } from "@/components/muted-info-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { MemberAvatar } from "@/components/member-avatar";
import { api } from "@/lib/api";
import { getErrorMessage, toastError } from "@/lib/errors";

export function MembersSettingsTab({
  selectedProject,
  queryClient,
  roles,
  userId,
  canManageMembers,
  canEditOwnRate,
  canEditRates,
}: {
  selectedProject: Project;
  queryClient: QueryClient;
  roles: Role[];
  userId: number | null;
  canManageMembers: boolean;
  canEditOwnRate: boolean;
  canEditRates: boolean;
}) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState("");
  const [deletingMember, setDeletingMember] = useState<ProjectMember | null>(null);

  const membersQuery = useQuery({
    queryKey: queryKeys.members.list(selectedProject.id),
    queryFn: () => api.members.list(selectedProject.id),
  });

  const invitationsQuery = useQuery({
    queryKey: queryKeys.invitations.all(selectedProject.id),
    queryFn: () => api.invitations.list(selectedProject.id),
  });

  const members = normalizeApiList(membersQuery.data);
  const invitations = normalizeApiList(invitationsQuery.data);

  const inviteMember = useMutation({
    mutationFn: () =>
      api.invitations.create(selectedProject.id, {
        email: inviteEmail,
        role: Number(inviteRoleId),
      }),
    onSuccess: async () => {
      toast.success("Invitation envoyee");
      setInviteEmail("");
      setInviteRoleId("");
      await queryClient.invalidateQueries({ queryKey: queryKeys.invitations.all(selectedProject.id) });
    },
    onError: toastError,
  });

  const removeInvitation = useMutation({
    mutationFn: (invitationId: number) => api.invitations.remove(selectedProject.id, invitationId),
    onSuccess: async () => {
      toast.success("Invitation annulee");
      await queryClient.invalidateQueries({ queryKey: queryKeys.invitations.all(selectedProject.id) });
    },
    onError: toastError,
  });

  const updateInvitationRole = useMutation({
    mutationFn: ({ invitationId, roleId }: { invitationId: number; roleId: number }) =>
      api.invitations.update(selectedProject.id, invitationId, { role: roleId }),
    onSuccess: async () => {
      toast.success("Role mis a jour");
      await queryClient.invalidateQueries({ queryKey: queryKeys.invitations.all(selectedProject.id) });
    },
    onError: toastError,
  });

  const removeMember = useMutation({
    mutationFn: (memberId: number) => api.members.remove(selectedProject.id, memberId),
    onSuccess: async () => {
      toast.success("Membre retire");
      setDeletingMember(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.members.list(selectedProject.id) });
    },
    onError: toastError,
  });

  const updateMemberRole = useMutation({
    mutationFn: ({ memberId, roleId }: { memberId: number; roleId: number }) =>
      api.members.update(selectedProject.id, memberId, { role: roleId }),
    onSuccess: async () => {
      toast.success("Role mis a jour");
      await queryClient.invalidateQueries({ queryKey: queryKeys.members.list(selectedProject.id) });
    },
    onError: toastError,
  });

  const updateMemberRate = useMutation({
    mutationFn: ({ memberId, rate }: { memberId: number; rate: string }) =>
      api.members.update(selectedProject.id, memberId, { hourly_rate: rate }),
    onSuccess: async () => {
      toast.success("Taux horaire mis a jour");
      await queryClient.invalidateQueries({ queryKey: queryKeys.members.list(selectedProject.id) });
    },
    onError: toastError,
  });

  const updateOwnerRate = useMutation({
    mutationFn: (rate: string) => api.members.updateOwnerRate(selectedProject.id, rate),
    onSuccess: async () => {
      toast.success("Taux horaire mis a jour");
      await queryClient.invalidateQueries({ queryKey: queryKeys.members.list(selectedProject.id) });
    },
    onError: toastError,
  });

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="size-4 text-primary" />
          Membres
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {canManageMembers ? (
          <form
            className="grid gap-2 rounded-md border bg-muted/30 p-3 sm:grid-cols-[1fr_180px_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              if (inviteEmail && inviteRoleId) inviteMember.mutate();
            }}
          >
            <Input
              type="email"
              placeholder="email@exemple.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
            <Select value={inviteRoleId} onValueChange={setInviteRoleId}>
              <SelectTrigger className="w-full bg-background">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={String(role.id)}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" disabled={!inviteEmail || !inviteRoleId || inviteMember.isPending}>
              Inviter
            </Button>
            <FormError message={getErrorMessage(inviteMember.error)} />
          </form>
        ) : null}

        <p className="text-sm text-muted-foreground">
          {members.length} membre(s) direct(s), {invitations.length} invitation(s).
        </p>

        <div className="grid gap-2 sm:grid-cols-2">
          {members.map((member) => {
            const isOwnerEntry = member.id === 0;
            const isOwnRow = member.user === userId;
            const canEditThisRate =
              isOwnerEntry
                ? isOwnRow
                : canEditRates || (canEditOwnRate && isOwnRow);

            return (
              <div
                key={member.id}
                className={`rounded-md border p-3 text-sm ${
                  member.role_deleted ? "border-red-200 bg-red-50/70" : "bg-muted/30"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <MemberAvatar name={member.user_display_name} pictureUrl={member.user_picture_url} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{member.user_display_name}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {isOwnerEntry ? (
                          <span className="text-xs text-muted-foreground">Proprietaire</span>
                        ) : canManageMembers ? (
                          <Select
                            value={member.role_deleted ? undefined : String(member.role)}
                            onValueChange={(value) =>
                              updateMemberRole.mutate({ memberId: member.id, roleId: Number(value) })
                            }
                          >
                            <SelectTrigger className="h-7 w-36 bg-background text-xs">
                              <SelectValue placeholder={member.role_deleted ? "Aucun role" : "Role"} />
                            </SelectTrigger>
                            <SelectContent>
                              {roles.map((role) => (
                                <SelectItem key={role.id} value={String(role.id)}>
                                  {role.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span
                            className={`text-xs ${member.role_deleted ? "text-red-700" : "text-muted-foreground"}`}
                          >
                            {member.role_deleted ? "Aucun role actif" : member.role_name}
                          </span>
                        )}
                        {canEditThisRate ? (
                          <div className="flex items-center gap-1">
                            <MoneyInput
                              className="h-7 w-20 bg-background text-xs"
                              defaultValue={member.hourly_rate}
                              onBlur={(e) => {
                                const val = e.target.value;
                                if (isOwnerEntry) {
                                  updateOwnerRate.mutate(val);
                                } else {
                                  updateMemberRate.mutate({ memberId: member.id, rate: val });
                                }
                              }}
                            />
                            <span className="text-xs text-muted-foreground">€/h</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">{member.hourly_rate} €/h</span>
                        )}
                      </div>
                      {member.role_deleted ? (
                        <p className="mt-1.5 text-xs font-medium text-red-700">
                          Ce membre n&apos;a plus de role actif.
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <MemberTypeBadge isOwner={isOwnerEntry} roleDeleted={member.role_deleted} />
                    {canManageMembers && !isOwnerEntry ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Supprimer ${member.user_display_name}`}
                        disabled={removeMember.isPending}
                        onClick={() => setDeletingMember(member)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}

          {invitations.map((invitation) => (
            <MutedInfoCard key={`invitation-${invitation.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{invitation.email}</p>
                  {canManageMembers ? (
                    <Select
                      value={String(invitation.role)}
                      onValueChange={(value) =>
                        updateInvitationRole.mutate({ invitationId: invitation.id, roleId: Number(value) })
                      }
                    >
                      <SelectTrigger className="mt-2 h-8 w-full bg-background sm:w-48">
                        <SelectValue placeholder="Role" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((role) => (
                          <SelectItem key={role.id} value={String(role.id)}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="mt-1 truncate text-xs text-muted-foreground">{invitation.role_name}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <InvitationStatusBadge status={invitation.status} />
                  {canManageMembers ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Annuler l'invitation ${invitation.email}`}
                      disabled={removeInvitation.isPending}
                      onClick={() => removeInvitation.mutate(invitation.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </div>
              </div>
            </MutedInfoCard>
          ))}
        </div>

        <FormError message={getErrorMessage(removeMember.error)} />
        <FormError message={getErrorMessage(updateMemberRole.error)} />
        <FormError message={getErrorMessage(updateMemberRate.error)} />
        <FormError message={getErrorMessage(updateOwnerRate.error)} />
        <FormError message={getErrorMessage(updateInvitationRole.error)} />
        <FormError message={getErrorMessage(removeInvitation.error)} />
      </CardContent>
      <ConfirmDeleteDialog
        open={deletingMember != null}
        title={`Retirer ${deletingMember?.user_display_name} du projet ?`}
        description="Ce membre perdra immediatement l'acces au projet."
        isPending={removeMember.isPending}
        onConfirm={() => deletingMember && removeMember.mutate(deletingMember.id)}
        onClose={() => setDeletingMember(null)}
      />
    </Card>
  );
}

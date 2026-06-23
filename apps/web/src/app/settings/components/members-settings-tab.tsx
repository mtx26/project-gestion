"use client";

import type { Project, Role } from "@project-gestion/types";
import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@project-gestion/query-keys";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Trash2, Users } from "lucide-react";
import { useState } from "react";
import { normalizeApiList } from "@project-gestion/api";
import { FormError } from "@/components/forms/form-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InvitationStatusBadge } from "@/components/badges/invitation-status-badge";
import { MemberTypeBadge } from "@/components/badges/member-type-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";

function MemberAvatar({ name, pictureUrl }: { name: string; pictureUrl: string | null }) {
  const initial = name.charAt(0).toUpperCase();
  if (pictureUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={pictureUrl} alt={name} className="size-8 shrink-0 rounded-full object-cover" />;
  }
  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
      {initial}
    </div>
  );
}

export function MembersSettingsTab({
  selectedProject,
  queryClient,
  roles,
  canManageMembers,
}: {
  selectedProject: Project;
  queryClient: QueryClient;
  roles: Role[];
  canManageMembers: boolean;
}) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState("");

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
  });

  const removeInvitation = useMutation({
    mutationFn: (invitationId: number) => api.invitations.remove(selectedProject.id, invitationId),
    onSuccess: async () => {
      toast.success("Invitation annulee");
      await queryClient.invalidateQueries({ queryKey: queryKeys.invitations.all(selectedProject.id) });
    },
  });

  const updateInvitationRole = useMutation({
    mutationFn: ({ invitationId, roleId }: { invitationId: number; roleId: number }) =>
      api.invitations.update(selectedProject.id, invitationId, { role: roleId }),
    onSuccess: async () => {
      toast.success("Role mis a jour");
      await queryClient.invalidateQueries({ queryKey: queryKeys.invitations.all(selectedProject.id) });
    },
  });

  const removeMember = useMutation({
    mutationFn: (memberId: number) => api.members.remove(selectedProject.id, memberId),
    onSuccess: async () => {
      toast.success("Membre retire");
      await queryClient.invalidateQueries({ queryKey: queryKeys.members.list(selectedProject.id) });
    },
  });

  const updateMemberRole = useMutation({
    mutationFn: ({ memberId, roleId }: { memberId: number; roleId: number }) =>
      api.members.update(selectedProject.id, memberId, { role: roleId }),
    onSuccess: async () => {
      toast.success("Role mis a jour");
      await queryClient.invalidateQueries({ queryKey: queryKeys.members.list(selectedProject.id) });
    },
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
            <FormError message={inviteMember.error ? getErrorMessage(inviteMember.error) : null} />
          </form>
        ) : null}

        <p className="text-sm text-muted-foreground">
          {members.length} membre(s) direct(s), {invitations.length} invitation(s).
        </p>

        <div className="grid gap-2 sm:grid-cols-2">
          {members.map((member) => (
            <div
              key={member.id}
              className={`rounded-md border p-3 text-sm ${
                member.role_deleted ? "border-red-200 bg-red-50/70" : "bg-muted/30"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2.5">
                  <MemberAvatar name={member.user_display_name} pictureUrl={member.user_picture_url} />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{member.user_display_name}</p>
                    {member.user === selectedProject.owner ? null : canManageMembers ? (
                      <Select
                        value={member.role_deleted ? undefined : String(member.role)}
                        onValueChange={(value) =>
                          updateMemberRole.mutate({ memberId: member.id, roleId: Number(value) })
                        }
                      >
                        <SelectTrigger className="mt-2 h-8 w-full bg-background sm:w-48">
                          <SelectValue placeholder={member.role_deleted ? "Aucun role actif" : "Role"} />
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
                      <p
                        className={`mt-1 truncate text-xs ${
                          member.role_deleted ? "text-red-700" : "text-muted-foreground"
                        }`}
                      >
                        {member.role_deleted ? "Aucun role actif" : member.role_name}
                      </p>
                    )}
                    {member.role_deleted ? (
                      <p className="mt-2 text-xs font-medium text-red-700">
                        Probleme: ce membre n&apos;a plus de role actif.
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <MemberTypeBadge isOwner={member.user === selectedProject.owner} roleDeleted={member.role_deleted} />
                  {canManageMembers && member.user !== selectedProject.owner ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Supprimer ${member.user_display_name}`}
                      disabled={removeMember.isPending}
                      onClick={() => removeMember.mutate(member.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}

          {invitations.map((invitation) => (
            <div key={`invitation-${invitation.id}`} className="rounded-md border bg-muted/30 p-3 text-sm">
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
            </div>
          ))}
        </div>

        <FormError message={removeMember.error ? getErrorMessage(removeMember.error) : null} />
        <FormError message={updateMemberRole.error ? getErrorMessage(updateMemberRole.error) : null} />
        <FormError message={updateInvitationRole.error ? getErrorMessage(updateInvitationRole.error) : null} />
        <FormError message={removeInvitation.error ? getErrorMessage(removeInvitation.error) : null} />
      </CardContent>
    </Card>
  );
}

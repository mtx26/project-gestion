"use client";

import { ApiError } from "@project-gestion/api";
import { API_BASE_URL } from "@project-gestion/config";
import { queryKeys } from "@project-gestion/query-keys";
import type { CalendarSubscription } from "@project-gestion/types";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, ExternalLink, Link as LinkIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDeleteDialog } from "@/components/dialogs/confirm-delete-dialog";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { getErrorMessage, toastError } from "@/lib/errors";
import { useCrudMutation } from "@/lib/use-crud-mutation";

interface CalendarSubscriptionDialogProps {
  projectId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canViewTasks: boolean;
  canViewTime: boolean;
}

/** Fetches the subscription here, then remounts `CalendarSubscriptionForm` (via
 * `key`) whenever its identity changes instead of syncing it into local state
 * through an effect — the form's checkboxes only need a correct *initial* value,
 * so a fresh mount is simpler than an effect fighting the user's own edits. */
export function CalendarSubscriptionDialog({
  projectId,
  open,
  onOpenChange,
  canViewTasks,
  canViewTime,
}: CalendarSubscriptionDialogProps) {
  const subscriptionQuery = useQuery({
    queryKey: queryKeys.calendar.subscription(projectId),
    queryFn: async () => {
      try {
        return await api.calendar.getSubscription(projectId);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
    enabled: open,
  });

  const subscription = subscriptionQuery.data ?? null;

  return (
    <CalendarSubscriptionForm
      key={subscription?.id ?? "new"}
      projectId={projectId}
      open={open}
      onOpenChange={onOpenChange}
      canViewTasks={canViewTasks}
      canViewTime={canViewTime}
      subscription={subscription}
      isLoading={subscriptionQuery.isLoading}
    />
  );
}

interface CalendarSubscriptionFormProps extends CalendarSubscriptionDialogProps {
  subscription: CalendarSubscription | null;
  isLoading: boolean;
}

function CalendarSubscriptionForm({
  projectId,
  open,
  onOpenChange,
  canViewTasks,
  canViewTime,
  subscription,
  isLoading,
}: CalendarSubscriptionFormProps) {
  const [includeTasks, setIncludeTasks] = useState(subscription?.include_tasks ?? canViewTasks);
  const [includeTime, setIncludeTime] = useState(subscription?.include_time ?? canViewTime);
  const [copied, setCopied] = useState(false);
  const [confirmRevokeOpen, setConfirmRevokeOpen] = useState(false);

  const saveMutation = useCrudMutation<void, CalendarSubscription>({
    mutationFn: () =>
      api.calendar.createSubscription(projectId, {
        include_tasks: includeTasks,
        include_time: includeTime,
      }),
    invalidateKey: queryKeys.calendar.subscription(projectId),
    successMessage: subscription ? "Lien mis a jour" : "Lien genere",
  });

  const revokeMutation = useCrudMutation<void, void>({
    mutationFn: () => api.calendar.deleteSubscription(projectId),
    invalidateKey: queryKeys.calendar.subscription(projectId),
    successMessage: "Lien revoque",
    onSuccess: () => setConfirmRevokeOpen(false),
  });

  const feedUrl = subscription ? `${API_BASE_URL}/api/calendar/${subscription.token}.ics` : null;
  const isDirty = subscription
    ? subscription.include_tasks !== includeTasks || subscription.include_time !== includeTime
    : true;

  async function handleCopy() {
    if (!feedUrl) return;
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      toast.success("Lien copie");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toastError(new Error("Impossible de copier le lien."));
    }
  }

  return (
    <>
      <FormDialog
        open={open}
        onOpenChange={onOpenChange}
        title="Abonnement calendrier"
        description="Genere un lien a coller dans Google Calendar, Outlook ou Apple Calendar pour suivre ce projet."
        maxWidth="md"
        error={getErrorMessage(saveMutation.error) ?? getErrorMessage(revokeMutation.error)}
        footer={
          <>
            {subscription ? (
              <Button
                type="button"
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirmRevokeOpen(true)}
                disabled={revokeMutation.isPending}
              >
                Revoquer
              </Button>
            ) : null}
            <Button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={(!includeTasks && !includeTime) || !isDirty || saveMutation.isPending}
            >
              <LinkIcon className="size-4" />
              {subscription ? "Mettre a jour" : "Generer le lien"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-5">
            {canViewTasks ? (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="calendar-sub-tasks"
                  checked={includeTasks}
                  onCheckedChange={(v) => setIncludeTasks(Boolean(v))}
                />
                <Label htmlFor="calendar-sub-tasks" className="cursor-pointer text-sm font-normal">
                  Inclure les taches
                </Label>
              </div>
            ) : null}
            {canViewTime ? (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="calendar-sub-time"
                  checked={includeTime}
                  onCheckedChange={(v) => setIncludeTime(Boolean(v))}
                />
                <Label htmlFor="calendar-sub-time" className="cursor-pointer text-sm font-normal">
                  Inclure le temps
                </Label>
              </div>
            ) : null}
          </div>

          {isLoading ? <Skeleton className="h-9 w-full" /> : null}

          {feedUrl ? (
            <div className="space-y-1.5">
              <Label>Lien d&apos;abonnement</Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={feedUrl}
                  className="font-mono text-xs"
                  onFocus={(event) => event.currentTarget.select()}
                />
                <Button type="button" variant="outline" size="icon" onClick={handleCopy} title="Copier le lien">
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                </Button>
                <Button type="button" variant="outline" size="icon" asChild title="Ouvrir le lien">
                  <a href={feedUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-4" />
                  </a>
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </FormDialog>

      <ConfirmDeleteDialog
        open={confirmRevokeOpen}
        title="Revoquer l'abonnement calendrier ?"
        description="Le lien deja distribue aux applications de calendrier cessera de fonctionner."
        isPending={revokeMutation.isPending}
        onConfirm={() => revokeMutation.mutate()}
        onClose={() => setConfirmRevokeOpen(false)}
      />
    </>
  );
}

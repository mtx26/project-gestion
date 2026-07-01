import type { DocumentInfo } from "@project-gestion/types";
import { Calendar, Folder, ListTodo, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { getDocumentIconConfig } from "@/lib/file-display";
import { formatDate } from "@/lib/task-utils";

interface EntryMetadataRowProps {
  taskId?: number | null;
  taskName?: string | null;
  folderId?: number | null;
  folderName?: string | null;
  documents?: DocumentInfo[];
  userName?: string | null;
  userIconClassName?: string;
  userPrefix?: string;
  date: string;
  showDateIcon?: boolean;
}

export function EntryMetadataRow({
  taskId,
  taskName,
  folderId,
  folderName,
  documents,
  userName,
  userIconClassName,
  userPrefix,
  date,
  showDateIcon,
}: EntryMetadataRowProps) {
  const docs = documents ?? [];
  return (
    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
      {taskId != null ? (
        <span className="inline-flex items-center gap-1">
          <ListTodo className="size-3 text-sky-600" />
          {taskName}
        </span>
      ) : folderId != null ? (
        <span className="inline-flex items-center gap-1">
          <Folder className="size-3 text-amber-500" />
          {folderName ?? `Dossier #${folderId}`}
        </span>
      ) : null}
      {docs.length > 0 ? (() => {
        const { Icon, className: iconClassName } = getDocumentIconConfig(docs[0]);
        return (
          <span className="inline-flex items-center gap-1">
            <Icon className={cn("size-3", iconClassName)} />
            {docs[0].name ?? `Document #${docs[0].id}`}
            {docs.length > 1 ? ` +${docs.length - 1}` : ""}
          </span>
        );
      })() : null}
      {userName ? (
        <span className="inline-flex items-center gap-1">
          <UserRound className={cn("size-3", userIconClassName)} />
          {userPrefix}
          {userName}
        </span>
      ) : null}
      <span className="ml-auto inline-flex shrink-0 items-center gap-1">
        {showDateIcon ? <Calendar className="size-3" /> : null}
        {formatDate(date)}
      </span>
    </div>
  );
}

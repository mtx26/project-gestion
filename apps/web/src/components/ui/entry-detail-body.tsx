"use client";

import type { FolderTreeNode } from "@project-gestion/types";
import { Eye, FileText, Folder, ListTodo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { findFolderName } from "@/lib/folder-utils";

type DocInfo = { id: number; name: string | null };

interface EntryDetailBodyProps {
  category?: string | null;
  description?: string | null;
  task_name?: string | null;
  folder?: number | null;
  documents_info?: DocInfo[];
  folders: FolderTreeNode[];
  isOpeningDocument: boolean;
  onOpenDocument: (documentId: number) => void;
}

export function EntryDetailBody({
  category,
  description,
  task_name,
  folder,
  documents_info,
  folders,
  isOpeningDocument,
  onOpenDocument,
}: EntryDetailBodyProps) {
  return (
    <>
      {category ? (
        <div>
          <p className="text-xs text-muted-foreground">Categorie</p>
          <p className="font-medium">{category}</p>
        </div>
      ) : null}

      {description ? (
        <div>
          <p className="text-xs text-muted-foreground">Description</p>
          <p className="text-sm">{description}</p>
        </div>
      ) : null}

      {task_name || folder ? (
        <div>
          <p className="text-xs text-muted-foreground">Cible</p>
          {task_name ? (
            <div className="flex items-center gap-1.5 text-sm">
              <ListTodo className="size-4 text-sky-600" />
              <span>{task_name}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-sm">
              <Folder className="size-4 text-amber-500" />
              <span>{findFolderName(folders, folder!) ?? `Dossier #${folder}`}</span>
            </div>
          )}
        </div>
      ) : null}

      {(documents_info ?? []).length > 0 ? (
        <div>
          <p className="mb-1.5 text-xs text-muted-foreground">Documents</p>
          <div className="flex flex-col gap-1.5">
            {(documents_info ?? []).map((doc) => (
              <div key={doc.id} className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{doc.name ?? `Document #${doc.id}`}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1.5"
                  disabled={isOpeningDocument}
                  onClick={() => onOpenDocument(doc.id)}
                >
                  <Eye className="size-3.5" />
                  Apercu
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

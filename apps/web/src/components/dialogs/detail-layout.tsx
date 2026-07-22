"use client";

import type { DocumentInfo } from "@project-gestion/types";
import type { LucideIcon } from "lucide-react";
import { Eye, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { FileAttachment } from "@/components/documents/file-attachment";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ─── Primitives ───────────────────────────────────────────────────────────────

export function DetailLabel({ children, className }: { children: string; className?: string }) {
  return (
    <p className={cn("text-[11px] font-medium uppercase tracking-wide text-muted-foreground", className)}>
      {children}
    </p>
  );
}

export function DetailField({
  label,
  icon: Icon,
  iconClassName,
  children,
  className,
}: {
  label: string;
  icon?: LucideIcon;
  iconClassName?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <DetailLabel>{label}</DetailLabel>
      <div className="mt-1.5 flex items-center gap-2 text-sm">
        {Icon ? <Icon className={cn("size-4 shrink-0 text-muted-foreground", iconClassName)} /> : null}
        {children}
      </div>
    </div>
  );
}

export function DetailGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-2 gap-x-8 gap-y-5", className)}>{children}</div>;
}

// ─── Section wrappers ─────────────────────────────────────────────────────────

/** Hero block — badge + big number, no top padding since it's the first section. */
export function ModalHero({ children }: { children: React.ReactNode }) {
  return <div className="pb-5">{children}</div>;
}

/** 2-column grid section — meta fields with icons. */
export function ModalGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <DetailGrid className={cn("py-5", className)}>{children}</DetailGrid>;
}

// ─── Documents block ──────────────────────────────────────────────────────────

export function ModalDocs({
  docs,
  projectId,
  isOpening,
  onOpen,
}: {
  docs: DocumentInfo[];
  projectId: number;
  isOpening: boolean;
  onOpen: (id: number) => void;
}) {
  if (docs.length === 0) return null;
  return (
    <div className="pt-5">
      <DetailLabel className="mb-3">Documents</DetailLabel>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {docs.map((doc) => (
          <FileAttachment
            key={doc.id}
            file={{ name: doc.name ?? `Document #${doc.id}`, mime_type: doc.mime_type, file_size: doc.file_size }}
            documentId={doc.id}
            projectId={projectId}
            size="sm"
            className="w-full"
            actions={
              <Button type="button" variant="outline" size="sm" disabled={isOpening} onClick={() => onOpen(doc.id)}>
                {isOpening ? <Spinner /> : <Eye className="size-3.5" />}
                Apercu
              </Button>
            }
          />
        ))}
      </div>
    </div>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

export function ModalFooter({
  destructive,
  actions,
}: {
  destructive?: { label: string; onClick: () => void; disabled?: boolean };
  actions?: React.ReactNode;
}) {
  if (!destructive && !actions) return null;

  return (
    <DialogFooter className="flex-row flex-wrap items-center justify-end">
      {destructive ? (
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={destructive.disabled}
          onClick={destructive.onClick}
        >
          {destructive.disabled ? <Spinner /> : <Trash2 className="size-4" />}
          {destructive.label}
        </Button>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        {actions}
      </div>
    </DialogFooter>
  );
}

// ─── Shell ────────────────────────────────────────────────────────────────────

export function DetailModal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="pr-6">{title}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="divide-y">{children}</div>
        </div>
        {footer}
      </DialogContent>
    </Dialog>
  );
}

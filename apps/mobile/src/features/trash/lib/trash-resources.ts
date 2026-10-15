import { formatDuration, FINANCIAL_SOURCE_LABELS } from "@project-gestion/domain";
import { permissionCodes, type PermissionCode } from "@project-gestion/permissions";
import type {
  ExpenseRequest,
  File as ApiFile,
  FinancialEntry,
  Folder,
  Project,
  Task,
  TimeEntry,
} from "@project-gestion/types";
import { formatDate } from "../../../lib/date-format";
import { formatMoney } from "../../../lib/money-format";

export type TrashResource =
  | "projects"
  | "folders"
  | "documents"
  | "tasks"
  | "time"
  | "finance"
  | "requests";

/** Un element supprime, quelle que soit sa nature : la corbeille les affiche tous
 * dans la meme liste, seul le libelle change. */
export type TrashItem = Project | Folder | ApiFile | Task | TimeEntry | FinancialEntry | ExpenseRequest;

interface TrashResourceConfig {
  label: string;
  /** Absent pour les projets : leur corbeille est globale, pas liee a un projet. */
  permission?: PermissionCode;
}

export const TRASH_RESOURCES: Record<TrashResource, TrashResourceConfig> = {
  projects: { label: "Projets" },
  folders: { label: "Dossiers", permission: permissionCodes.fileRestore },
  documents: { label: "Documents", permission: permissionCodes.fileRestore },
  tasks: { label: "Taches", permission: permissionCodes.taskRestore },
  time: { label: "Temps", permission: permissionCodes.timeEntryRestore },
  finance: { label: "Finances", permission: permissionCodes.financeRestore },
  requests: { label: "Demandes", permission: permissionCodes.expenseRequestRestore },
};

/** Ressources reellement consultables, dans l'ordre d'affichage — c'est ce que le
 * selecteur propose, plutot que des onglets grises comme sur le web. */
export function getAvailableTrashResources(can: (code: PermissionCode) => boolean) {
  return (Object.keys(TRASH_RESOURCES) as TrashResource[])
    .filter((resource) => {
      const permission = TRASH_RESOURCES[resource].permission;
      return permission == null || can(permission);
    })
    .map((resource) => ({ label: TRASH_RESOURCES[resource].label, value: resource }));
}

/** Titre et sous-titre d'une ligne de corbeille : chaque ressource a son identite
 * (un montant pour une ecriture, une duree pour du temps...). */
export function getTrashItemLabels(resource: TrashResource, item: TrashItem): {
  title: string;
  subtitle: string;
} {
  const deletedAt = item.deleted_at ? `Supprime le ${formatDate(item.deleted_at)}` : "";

  if (resource === "tasks") {
    const task = item as Task;
    return { title: task.title, subtitle: [task.folder_name, deletedAt].filter(Boolean).join(" · ") };
  }
  if (resource === "time") {
    const entry = item as TimeEntry;
    return {
      title: entry.title || "Temps enregistre",
      subtitle: [
        formatDuration(entry.duration_minutes),
        formatMoney(entry.cost_amount),
        entry.user_display_name,
        deletedAt,
      ]
        .filter(Boolean)
        .join(" · "),
    };
  }
  if (resource === "finance") {
    const entry = item as FinancialEntry;
    return {
      title: `${entry.type === "expense" ? "-" : "+"}${formatMoney(entry.amount)}`,
      subtitle: [FINANCIAL_SOURCE_LABELS[entry.source], entry.description, deletedAt]
        .filter(Boolean)
        .join(" · "),
    };
  }
  if (resource === "requests") {
    const request = item as ExpenseRequest;
    return {
      title: request.title,
      subtitle: [formatMoney(request.amount), request.requested_by_name, deletedAt]
        .filter(Boolean)
        .join(" · "),
    };
  }

  // Projets, dossiers et documents partagent la meme identite : un nom.
  const named = item as Project | Folder | ApiFile;
  return { title: named.name, subtitle: deletedAt };
}

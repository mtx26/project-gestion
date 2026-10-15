import type { FolderTreeNode, TimeEntry } from "@project-gestion/types";

/** Cible d'une ecriture : le projet (racine), un dossier ou une tache. Encodee en
 * chaine (`"project"` / `"folder-12"` / `"task-4"`) pour servir a la fois de valeur
 * unique dans un selecteur, de parametre d'URL et de filtre serveur. */
export type TargetValue = string;

export function getTargetTypeFromValue(value: TargetValue): "project" | "folder" | "task" {
  if (value.startsWith("task-")) return "task";
  if (value.startsWith("folder-")) return "folder";
  return "project";
}

export function getTargetPayload(value: TargetValue): { folder: number | null; task: number | null } {
  if (value.startsWith("folder-")) return { folder: Number(value.replace("folder-", "")), task: null };
  if (value.startsWith("task-")) return { folder: null, task: Number(value.replace("task-", "")) };
  return { folder: null, task: null };
}

export function getTargetValueFromEntry(entry: Pick<TimeEntry, "folder" | "task">): TargetValue {
  if (entry.task != null) return `task-${entry.task}`;
  if (entry.folder != null) return `folder-${entry.folder}`;
  return "project";
}

/** Retrouve le dossier/la tache dont la valeur encodee correspond, en parcourant
 * l'arbre tel que le backend le renvoie (sans copie intermediaire) — `"project"`
 * court-circuite, ce n'est pas un vrai noeud. */
export function findTargetLabel(nodes: FolderTreeNode[], value: TargetValue): string | null {
  if (value === "project") return "Projet";
  for (const node of nodes) {
    if (node.type !== "folder" && node.type !== "task") continue;
    if (`${node.type}-${node.id}` === value) return node.name;
    if (node.type === "folder") {
      const label = findTargetLabel(node.children ?? [], value);
      if (label) return label;
    }
  }
  return null;
}

export type EntryTarget = { type: "task" | "folder"; id: number; name: string | null };

/** Reunit le couple `task`/`folder` d'une entree en une seule cible affichable — le
 * pendant de `getTargetValueFromEntry` (qui, lui, construit la valeur de formulaire).
 * `null` quand l'entree est rattachee au projet. */
export function getEntryTarget(entry: {
  task: number | null;
  task_name?: string | null;
  folder: number | null;
  folder_name?: string | null;
}): EntryTarget | null {
  if (entry.task != null) return { type: "task", id: entry.task, name: entry.task_name ?? null };
  if (entry.folder != null) return { type: "folder", id: entry.folder, name: entry.folder_name ?? null };
  return null;
}

/** Libelle affichable de la cible, avec un repli quand le nom n'est pas resolu
 * (dossier ou tache supprime). */
export function getEntryTargetLabel(entry: {
  task: number | null;
  task_name?: string | null;
  folder: number | null;
  folder_name?: string | null;
}): string {
  if (entry.task != null) return entry.task_name ?? "Tache liee";
  if (entry.folder != null) return entry.folder_name ?? "Dossier lie";
  return "Projet";
}

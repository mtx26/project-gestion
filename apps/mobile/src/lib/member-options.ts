import type { ProjectMember } from "@project-gestion/types";

interface MemberFilterOptions {
  allLabel?: string;
  selfLabel?: string;
  /** Ajoute une option "non attribue" (valeur `"none"`) — seulement pour les listes
   * ou une ligne peut avoir perdu son titulaire (entrees de temps orphelines). */
  unassignedLabel?: string;
}

/** "Tous" + "Moi" + le reste des membres du projet, en options d'action sheet —
 * la forme recurrente derriere chaque filtre membre unique ("assigne a", "cree par",
 * "demande par", "titulaire") des ecrans de liste. */
export function buildMemberFilterOptions(
  members: ProjectMember[],
  currentUserId: number | null,
  { allLabel = "Tous", selfLabel = "Moi", unassignedLabel }: MemberFilterOptions = {},
) {
  return [
    { label: allLabel, value: "all" },
    { label: selfLabel, value: String(currentUserId ?? "") },
    ...members
      .filter((member) => member.user !== currentUserId)
      .map((member) => ({ label: member.user_display_name, value: String(member.user) })),
    ...(unassignedLabel ? [{ label: unassignedLabel, value: "none" }] : []),
  ];
}

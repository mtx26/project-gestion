import type { ProjectMember } from "@project-gestion/types";

/** "Tous" + "Moi" + the rest of the project's members, as action-sheet
 * options — the recurring shape behind every "assigne a" / "cree par" /
 * "demande par" single-member filter across list screens. */
export function buildMemberFilterOptions(members: ProjectMember[], currentUserId: number | null) {
  return [
    { label: "Tous", value: "all" },
    { label: "Moi", value: String(currentUserId ?? "") },
    ...members
      .filter((member) => member.user !== currentUserId)
      .map((member) => ({ label: member.user_display_name, value: String(member.user) })),
  ];
}

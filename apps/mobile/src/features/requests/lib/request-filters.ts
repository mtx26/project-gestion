export type RequestStatusFilter = "all" | "pending" | "approved" | "rejected";

export const STATUS_OPTIONS: { label: string; value: RequestStatusFilter }[] = [
  { label: "Tous statuts", value: "all" },
  { label: "En attente", value: "pending" },
  { label: "Approuve", value: "approved" },
  { label: "Refuse", value: "rejected" },
];

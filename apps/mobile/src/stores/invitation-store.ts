import { create } from "zustand";

type InvitationState = {
  /** Jeton d'invitation recu par lien profond alors que personne n'etait connecte :
   * garde le temps de la connexion, puis rejoue automatiquement. Sans ca, le lien
   * serait perdu au moment ou l'app bascule sur l'ecran de connexion. */
  pendingToken: string | null;
  setPendingToken: (token: string) => void;
  clearPendingToken: () => void;
};

export const useInvitationStore = create<InvitationState>((set) => ({
  pendingToken: null,
  setPendingToken: (token) => set({ pendingToken: token }),
  clearPendingToken: () => set({ pendingToken: null }),
}));

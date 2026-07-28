import { create } from "zustand";

type ProjectStoreState = {
  manualSelectedProjectId: string;
  selectProject: (id: number | string) => void;
};

export const useProjectStore = create<ProjectStoreState>((set) => ({
  manualSelectedProjectId: "",
  selectProject: (id) => set({ manualSelectedProjectId: String(id) }),
}));

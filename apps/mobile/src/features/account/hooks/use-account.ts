import type { User, UserUpdatePayload } from "@project-gestion/types";
import { useMutation } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import type { PendingUpload } from "../../../lib/document-picker";
import { useAuthStore } from "../../../stores/auth-store";

/** Le profil vit dans le store d'auth (il alimente le menu, l'avatar, le projet par
 * defaut) : chaque mutation y republie l'utilisateur renvoye par le serveur plutot
 * que d'invalider une requete. */
function setUser(user: User) {
  useAuthStore.setState({ user });
}

export function useUpdateAccount() {
  return useMutation({
    mutationFn: (payload: UserUpdatePayload) => api.auth.updateMe(payload),
    onSuccess: setUser,
  });
}

export function useUploadProfilePicture() {
  return useMutation({
    mutationFn: (file: PendingUpload) => api.auth.uploadProfilePicture(file),
    onSuccess: setUser,
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (payload: { old_password: string; new_password: string }) =>
      api.auth.changePassword(payload),
  });
}

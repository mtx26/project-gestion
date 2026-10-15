import NetInfo from "@react-native-community/netinfo";
import { QueryClient, focusManager, onlineManager } from "@tanstack/react-query";
import { AppState, type AppStateStatus } from "react-native";

/** React Query est ecrit pour le navigateur : "la fenetre reprend le focus" et "le
 * reseau revient" n'existent pas tels quels en React Native. Sans ce branchement,
 * aucune requete ne se rafraichit quand on revient dans l'app, et les mutations
 * hors ligne partent quand meme (puis echouent). Les deux managers sont globaux, on
 * les branche donc une seule fois au chargement du module. */
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => {
    // `isInternetReachable` vaut `null` tant que la sonde n'a pas repondu : on ne
    // declare hors ligne que ce qui l'est vraiment.
    setOnline(Boolean(state.isConnected) && state.isInternetReachable !== false);
  }),
);

focusManager.setEventListener((handleFocus) => {
  const subscription = AppState.addEventListener("change", (status: AppStateStatus) => {
    handleFocus(status === "active");
  });

  return () => subscription.remove();
});

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
      },
    },
  });
}

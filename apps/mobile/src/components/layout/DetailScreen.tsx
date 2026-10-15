import { Stack } from "expo-router";
import type { ReactNode } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ErrorState } from "../feedback/ErrorState";
import { LoadingState } from "../feedback/LoadingState";

interface DetailScreenProps {
  /** Titre du header natif. A omettre quand l'ecran declare lui-meme un
   * `Stack.Screen` plus riche (actions dans le header, par exemple). */
  title?: string;
  /** L'ecran est presente sans header natif (une modale) : la safe area doit
   * alors couvrir le haut. Par defaut elle ne le fait pas, le header natif
   * s'occupant deja de la barre d'etat. */
  includeTopEdge?: boolean;
  isLoading?: boolean;
  /** Rend `ErrorState` a la place du contenu. `undefined` = pas d'erreur. */
  error?: unknown;
  errorMessage?: string | null;
  onRetry?: () => void;
  /** L'ecran gere son propre defilement (ScrollView, FlatList...). */
  children: ReactNode;
}

/** Coquille des ecrans de detail et de listes secondaires — celle qui manquait.
 *
 * Onze ecrans repetaient la meme `SafeAreaView`, le meme commentaire sur le
 * header natif et le meme aiguillage chargement/erreur. Chaque correction de
 * safe area ou de theme devait donc etre repetee onze fois, et une seule oubliee
 * se voyait. Tout cela vit ici desormais.
 *
 * Les ecrans de section du drawer gardent `ProjectSectionScreen` (qui gere en
 * plus le projet selectionne et les permissions) ; les formulaires modaux
 * gardent `FormScreen`. */
export function DetailScreen({
  title,
  includeTopEdge = false,
  isLoading,
  error,
  errorMessage,
  onRetry,
  children,
}: DetailScreenProps) {
  const edges = includeTopEdge
    ? (["top", "bottom", "left", "right"] as const)
    : (["bottom", "left", "right"] as const);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={[...edges]}>
      {title ? <Stack.Screen options={{ title }} /> : null}

      {isLoading ? (
        <LoadingState />
      ) : error != null ? (
        // L'erreur remplace le contenu, elle porte donc sa propre marge : sans
        // elle, le message colle aux bords de l'ecran.
        <View className="px-5 py-6">
          <ErrorState message={errorMessage ?? "Une erreur est survenue."} onRetry={onRetry} />
        </View>
      ) : (
        children
      )}
    </SafeAreaView>
  );
}

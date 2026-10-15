import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { AccessibilityInfo, View, type StyleProp, type ViewStyle } from "react-native";

/** `isLiquidGlassAvailable()` interroge le binaire, pas l'etat de l'app : le
 * resultat ne changera pas d'un rendu a l'autre. Evalue une fois au chargement du
 * module plutot qu'a chaque rendu.
 *
 * Sous try/catch parce que la version iOS passe par `requireNativeModule`, qui
 * leve si `expo-glass-effect` n'est pas dans le binaire — typiquement un dev
 * client construit avant son ajout. Un effet decoratif ne doit pas empecher
 * l'app de demarrer : on retombe alors sur la surface pleine. */
function detectLiquidGlass(): boolean {
  try {
    return isLiquidGlassAvailable();
  } catch {
    return false;
  }
}

const HAS_LIQUID_GLASS = detectLiquidGlass();

/** Le verre doit-il etre rendu, ici et maintenant ?
 *
 * `isLiquidGlassAvailable()` ne repond qu'a « le binaire en est-il capable ». Il
 * reste vrai quand l'utilisateur a active **Reduire la transparence** dans les
 * reglages d'accessibilite — reglage qu'Apple impose de respecter, et que la doc
 * d'`expo-glass-effect` renvoie explicitement vers
 * `AccessibilityInfo.isReduceTransparencyEnabled()`. On retombe alors sur les
 * surfaces pleines, qui restent parfaitement lisibles.
 *
 * Le reglage est modifiable sans quitter l'app : on s'abonne a ses changements
 * plutot que de le lire une seule fois. */
export function useGlassEnabled(): boolean {
  const [reduceTransparency, setReduceTransparency] = useState(false);

  useEffect(() => {
    // Hors iOS 26 le verre n'est de toute facon pas rendu : rien a observer.
    if (!HAS_LIQUID_GLASS) {
      return;
    }
    let active = true;
    void AccessibilityInfo.isReduceTransparencyEnabled().then((enabled) => {
      if (active) {
        setReduceTransparency(enabled);
      }
    });
    const subscription = AccessibilityInfo.addEventListener(
      "reduceTransparencyChanged",
      setReduceTransparency,
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return HAS_LIQUID_GLASS && !reduceTransparency;
}

interface GlassSurfaceProps {
  children: ReactNode;
  /** Style applique dans les deux cas (position, taille, rayon...). Le rayon doit
   * etre porte ici : c'est lui qui decoupe le materiau natif. */
  style?: StyleProp<ViewStyle>;
  /** Classes du repli, quand le verre n'est pas disponible. Reprendre l'apparence
   * pleine habituelle de la surface concernee. */
  fallbackClassName?: string;
  /** `regular` par defaut. `clear` est plus transparent : a reserver au contenu
   * tres contraste derriere. */
  glassEffectStyle?: "clear" | "regular";
  /** Teinte le verre. Sur cette app, la palette est claire et opaque : ne teinter
   * que pour marquer une surface active. */
  tintColor?: string;
  /** Le verre reagit au toucher, comme les controles du systeme. A reserver aux
   * surfaces reellement pressables. */
  isInteractive?: boolean;
}

/** Vrai pour les descendants d'une surface en verre. Les controles poses dessus
 * doivent alors abandonner leur fond opaque : du verre sur du verre est un
 * contresens, et une pastille pleine sur une barre translucide fait tache. */
const OnGlassContext = createContext(false);

export function useOnGlass(): boolean {
  return useContext(OnGlassContext);
}

/** Surface de la couche de navigation en Liquid Glass, avec repli automatique.
 *
 * `expo-glass-effect` exige **iOS 26+** ; partout ailleurs (Android, iOS < 26,
 * web) `isLiquidGlassAvailable()` est faux et on rend la surface pleine
 * d'origine. La parite Android est donc structurelle, pas a maintenir a la main.
 *
 * A n'utiliser que pour ce qui **flotte au-dessus du contenu** — panneau de
 * navigation, barre d'outils, controle d'en-tete. Apple reserve le verre a cette
 * couche : sur une carte de contenu il nuit a la lisibilite et trahit le systeme. */
export function GlassSurface({
  children,
  style,
  fallbackClassName,
  glassEffectStyle = "regular",
  tintColor,
  isInteractive,
}: GlassSurfaceProps) {
  const glassEnabled = useGlassEnabled();

  if (!glassEnabled) {
    return (
      <View style={style} className={fallbackClassName}>
        {children}
      </View>
    );
  }

  return (
    <GlassView
      style={style}
      glassEffectStyle={glassEffectStyle}
      tintColor={tintColor}
      isInteractive={isInteractive}
      // `auto` : l'app suit desormais l'apparence du systeme
      // (`userInterfaceStyle: "automatic"`), le verre doit en faire autant.
      colorScheme="auto"
    >
      <OnGlassContext.Provider value>{children}</OnGlassContext.Provider>
    </GlassView>
  );
}

import { useColorScheme } from "nativewind";

export interface BadgeStyle {
  bg: string;
  text: string;
}

/** Les couleurs semantiques n'ont pas d'equivalent dans la palette neutre du
 * theme — meme exception documentee que les badges du web
 * (`apps/web/src/components/badges/*`). Elles ont donc leurs propres variantes
 * claires et sombres.
 *
 * Le principe en sombre est inverse : fond profond tres sature, texte clair. Les
 * pastels du mode clair, poses tels quels sur un fond quasi noir, eblouissent et
 * attirent l'oeil bien plus que l'information ne le merite. */
export const badgeTones = {
  grey: {
    light: { bg: "#e5e7eb", text: "#374151" },
    dark: { bg: "#262626", text: "#d4d4d4" },
  },
  slate: {
    light: { bg: "#f1f5f9", text: "#475569" },
    dark: { bg: "#1e293b", text: "#cbd5e1" },
  },
  blue: {
    light: { bg: "#dbeafe", text: "#1e40af" },
    dark: { bg: "#172554", text: "#93c5fd" },
  },
  green: {
    light: { bg: "#dcfce7", text: "#166534" },
    dark: { bg: "#052e16", text: "#86efac" },
  },
  red: {
    light: { bg: "#fee2e2", text: "#991b1b" },
    dark: { bg: "#450a0a", text: "#fca5a5" },
  },
  amber: {
    light: { bg: "#fef3c7", text: "#92400e" },
    dark: { bg: "#451a03", text: "#fcd34d" },
  },
  orange: {
    light: { bg: "#ffedd5", text: "#9a3412" },
    dark: { bg: "#431407", text: "#fdba74" },
  },
  yellow: {
    light: { bg: "#fef9c3", text: "#854d0e" },
    dark: { bg: "#422006", text: "#fde047" },
  },
  indigo: {
    light: { bg: "#e0e7ff", text: "#3730a3" },
    dark: { bg: "#1e1b4b", text: "#a5b4fc" },
  },
} as const;

export type BadgeTone = keyof typeof badgeTones;

/** Resout une teinte de badge dans l'apparence courante. */
export function useBadgeStyle(tone: BadgeTone): BadgeStyle {
  const { colorScheme } = useColorScheme();
  return badgeTones[tone][colorScheme === "dark" ? "dark" : "light"];
}

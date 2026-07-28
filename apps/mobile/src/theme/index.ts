import { theme as sharedTheme } from "@project-gestion/config";

export const theme = {
  colors: sharedTheme.colors,
  spacing: sharedTheme.spacing,
  radius: sharedTheme.radius,
  typography: {
    title: { fontSize: 24, fontWeight: "600" as const },
    subtitle: { fontSize: 14, fontWeight: "600" as const },
    body: { fontSize: 14, fontWeight: "400" as const },
    label: { fontSize: 14, fontWeight: "500" as const },
  },
  iconSize: {
    sm: 16,
    md: 20,
    lg: 24,
  },
  touchSize: {
    minimum: 44,
  },
} as const;

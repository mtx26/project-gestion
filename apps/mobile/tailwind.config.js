/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  // Pas de `darkMode` : NativeWind s'appuie alors sur `prefers-color-scheme`,
  // c'est-a-dire l'apparence du systeme, ce que fait deja le web par defaut.
  theme: {
    extend: {
      colors: {
        // `<alpha-value>` preserve les opacites existantes (`bg-primary/10`).
        background: "rgb(var(--color-background) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        foreground: "rgb(var(--color-foreground) / <alpha-value>)",
        muted: "rgb(var(--color-muted) / <alpha-value>)",
        border: "rgb(var(--color-border) / <alpha-value>)",
        primary: "rgb(var(--color-primary) / <alpha-value>)",
        primaryForeground: "rgb(var(--color-primary-foreground) / <alpha-value>)",
        danger: "rgb(var(--color-danger) / <alpha-value>)",
        dangerForeground: "rgb(var(--color-danger-foreground) / <alpha-value>)",
      },
      borderRadius: {
        md: "8px",
      },
    },
  },
  plugins: [],
};

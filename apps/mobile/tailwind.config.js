/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "#f8fafc",
        surface: "#ffffff",
        foreground: "#111827",
        muted: "#6b7280",
        border: "#e5e7eb",
        primary: "#0f766e",
        primaryForeground: "#ffffff",
        danger: "#dc2626",
      },
      borderRadius: {
        md: "8px",
      },
    },
  },
  plugins: [],
};

import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bear: {
          bg: "#1d1d1d",
          sidebar: "#252525",
          list: "#2a2a2a",
          editor: "#1d1d1d",
          hover: "#333333",
          active: "#3a3a3a",
          border: "#3a3a3a",
          text: "#e0e0e0",
          "text-secondary": "#999999",
          "text-muted": "#666666",
          accent: "#d63031",
          "accent-hover": "#e74c3c",
          tag: "#e17055",
          "tag-bg": "#3d2520",
          link: "#74b9ff",
          "inline-code": "#2d2d2d",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "SF Mono",
          "Menlo",
          "Monaco",
          "Consolas",
          "Liberation Mono",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
} satisfies Config;

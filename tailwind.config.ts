import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bear: {
          bg: "var(--bear-bg)",
          sidebar: "var(--bear-sidebar)",
          list: "var(--bear-list)",
          editor: "var(--bear-editor)",
          hover: "var(--bear-hover)",
          active: "var(--bear-active)",
          border: "var(--bear-border)",
          text: "var(--bear-text)",
          "text-secondary": "var(--bear-text-secondary)",
          "text-muted": "var(--bear-text-muted)",
          accent: "var(--bear-accent)",
          "accent-hover": "var(--bear-accent-hover)",
          tag: "var(--bear-tag)",
          "tag-bg": "var(--bear-tag-bg)",
          link: "var(--bear-link)",
          "inline-code": "var(--bear-inline-code)",
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

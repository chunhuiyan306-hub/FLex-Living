import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#fafafa",
          card: "#ffffff",
          muted: "#f5f5f7",
        },
        ink: {
          DEFAULT: "#1d1d1f",
          secondary: "#6e6e73",
          tertiary: "#86868b",
        },
        line: "#d2d2d7",
      },
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Text",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.04)",
        drawer: "-24px 0 48px rgba(0,0,0,0.06)",
      },
    },
  },
  plugins: [],
} satisfies Config;

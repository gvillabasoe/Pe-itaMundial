import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        display: ['"Outfit"', 'system-ui', 'sans-serif'],
      },
      colors: {
        gold: "rgb(var(--gold) / <alpha-value>)",
        "gold-light": "rgb(var(--gold-light) / <alpha-value>)",
        "gold-soft": "rgb(var(--gold-soft) / <alpha-value>)",
        navy: "rgb(var(--navy) / <alpha-value>)",
        success: "rgb(var(--success) / <alpha-value>)",
        danger: "rgb(var(--danger) / <alpha-value>)",
        amber: "rgb(var(--amber) / <alpha-value>)",
        "amber-mid": "rgb(var(--amber) / <alpha-value>)",
        "text-primary": "rgb(var(--text-primary) / <alpha-value>)",
        "text-secondary": "rgb(var(--text-secondary) / <alpha-value>)",
        "text-muted": "rgb(var(--text-muted) / <alpha-value>)",
        "text-warm": "rgb(var(--text-warm) / <alpha-value>)",
        "text-faint": "rgb(var(--text-faint) / <alpha-value>)",
        "bg-0": "rgb(var(--bg-canvas) / <alpha-value>)",
        "bg-1": "rgb(var(--bg-surface) / <alpha-value>)",
        "bg-2": "rgb(var(--bg-muted) / <alpha-value>)",
        "bg-3": "rgb(var(--bg-muted) / <alpha-value>)",
        "bg-4": "rgb(var(--bg-surface) / <alpha-value>)",
        "bg-5": "rgb(var(--bg-muted) / <alpha-value>)",
        "bg-6": "rgb(var(--bg-elevated) / <alpha-value>)",
      },
    },
  },
  plugins: [],
};

export default config;

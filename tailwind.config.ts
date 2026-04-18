import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          0: "rgb(var(--bg-0) / <alpha-value>)",
          1: "rgb(var(--bg-1) / <alpha-value>)",
          2: "rgb(var(--bg-2) / <alpha-value>)",
          3: "rgb(var(--bg-3) / <alpha-value>)",
          4: "rgb(var(--bg-4) / <alpha-value>)",
          5: "rgb(var(--bg-5) / <alpha-value>)",
          6: "rgb(var(--bg-6) / <alpha-value>)",
        },
        text: {
          primary: "rgb(var(--text-primary) / <alpha-value>)",
          warm: "rgb(var(--text-warm) / <alpha-value>)",
          muted: "rgb(var(--text-muted) / <alpha-value>)",
        },
        gold: "#D4AF37",
        "gold-light": "#FFD87A",
        "gold-lighter": "#FFE5A3",
        "gold-dark": "#C99625",
        silver: "#C0C0C0",
        bronze: "#CD7F32",
        success: "#27E6AC",
        danger: "#FF7AA5",
        "amber-mid": "#DFBE38",
        accent: {
          clasificacion: "#D9B449",
          participante: "#6BBF78",
          versus: "#F0417A",
        },
        group: {
          a: "#6BBF78",
          b: "#EC1522",
          c: "#EAEA7E",
          d: "#0C66B6",
          e: "#F48020",
          f: "#006858",
          g: "#B0A8D9",
          h: "#55BCBB",
          i: "#4E3AA2",
          j: "#FEA999",
          k: "#F0417A",
          l: "#82001C",
        },
      },
      fontFamily: {
        sans: ["DM Sans", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Outfit", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        livePulse: {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: "0.45" },
        },
        countPulse: {
          "0%,100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.03)" },
        },
      },
      animation: {
        "fade-in": "fadeIn 220ms ease-out forwards",
        "slide-up": "slideUp 260ms ease-out forwards",
        "live-pulse": "livePulse 1.4s ease-in-out infinite",
        "count-pulse": "countPulse 1s ease-in-out infinite",
      },
      boxShadow: {
        card: "0 18px 42px rgba(0, 0, 0, 0.28)",
        glow: "0 0 30px rgba(212, 175, 55, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;

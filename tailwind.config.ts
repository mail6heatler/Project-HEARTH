import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      screens: { vesta: "1180px" },
      // Hex values, not var(--x): Tailwind can only apply opacity modifiers like border-warn/60 to colours it can parse.
      // Keep in sync with the variables in app/globals.css.
      colors: {
        bg: "#070b14",
        panel: "#0d1322",
        raised: "#131b2e",
        line: "#1f2a44",
        text: "#e8ecf6",
        muted: "#97a3bc",
        // the accent VESTA's skins swap: "R G B" channels from CSS variables, so opacity modifiers like bg-ember/10 still work
        ember: { DEFAULT: "rgb(var(--ember-rgb) / <alpha-value>)", soft: "rgb(var(--ember-soft-rgb) / <alpha-value>)" },
        acme: "#4cc9f0",
        cfi: "#a78bfa",
        spice: "#5ee6a8",
        ok: "#5ee6a8",
        warn: "#ffc857",
        bad: "#ff5d6c",
        star: "#cfe6ff",
      },
      fontFamily: {
        head: ["var(--font-head)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      keyframes: {
        pulseRing: {
          "0%": { transform: "scale(0.9)", opacity: "0.9" },
          "100%": { transform: "scale(1.8)", opacity: "0" },
        },
        fadeUp: {
          "0%": { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        flicker: {
          "0%,100%": { transform: "scaleY(1)", opacity: "1" },
          "50%": { transform: "scaleY(1.05)", opacity: "0.92" },
        },
        slideIn: {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
        twinkle: {
          "0%,100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.6", transform: "scale(0.82)" },
        },
        alertIn: {
          "0%": { boxShadow: "0 0 0 0 currentColor" },
          "100%": { boxShadow: "0 0 0 10px transparent" },
        },
      },
      animation: {
        pulseRing: "pulseRing 1.8s ease-out infinite",
        fadeUp: "fadeUp 0.45s ease-out both",
        flicker: "flicker 2.4s ease-in-out infinite",
        slideIn: "slideIn 0.3s ease-out both",
        twinkle: "twinkle 3.2s ease-in-out infinite",
        alertIn: "alertIn 0.9s ease-out 2",
      },
    },
  },
  plugins: [],
};
export default config;

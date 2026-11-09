import type { Config } from "tailwindcss";

// Colours come from CSS variables (see globals.css) so the app opens in the LIGHT
// theme by default and switches to dark with the toggle. <alpha-value> keeps
// opacity utilities like bg-aster/15 working.
const v = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: v("ink"),
        panel: v("panel"),
        panel2: v("panel2"),
        line: v("line"),
        mut: v("mut"),
        fg: v("fg"),
        aster: v("aster"),
        aster2: v("aster2"),
        good: v("good"),
        warn: v("warn"),
        bad: v("bad"),
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;

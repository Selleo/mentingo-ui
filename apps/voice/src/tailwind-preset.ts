import type { Config } from "tailwindcss";

const scale = (name: string) =>
  Object.fromEntries(
    [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((step) => [
      step,
      `var(--${name}-${step})`,
    ]),
  );

const voicePreset = {
  content: [],
  theme: {
    extend: {
      colors: {
        neutral: scale("neutral"),
        primary: {
          ...scale("primary"),
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        contrast: "var(--contrast)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        input: "var(--input)",
        ring: "var(--ring)",
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
        },
      },
    },
  },
} satisfies Config;

export default voicePreset;

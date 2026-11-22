import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#09090B",
        surface: "#111114",
        "surface-muted": "#16161A",
        border: "#1E293B",
        accent: {
          DEFAULT: "#4F46E5",
          hover: "#4338CA",
          muted: "rgba(79, 70, 229, 0.15)",
        },
        "text-primary": "#F8FAFC",
        "text-muted": "#94A3B8",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;

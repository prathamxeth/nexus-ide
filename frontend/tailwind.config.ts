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
        cursor: {
          canvas: "#141414",
          panel: "#181818",
          sidebar: "#181818",
          border: "#282828",
          active: "#222222",
          hover: "#1f1f1f",
          green: "#22c55e",
          red: "#ef4444",
          blue: "#3b82f6",
          text: "#e5e5e5",
          muted: "#888888",
        },
      },
    },
  },
  plugins: [],
};

export default config;

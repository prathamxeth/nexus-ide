/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ide: {
          bg: "#141414",
          panel: "#181818",
          sidebar: "#1e1e1e",
          border: "#282828",
          active: "#252525",
          hover: "#2a2a2a",
        },
      },
    },
  },
  plugins: [],
};

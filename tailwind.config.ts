import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        posi: {
          DEFAULT: "#22c55e",  // green-500
          dark: "#16a34a",
          light: "#dcfce7",
        },
        nega: {
          DEFAULT: "#ef4444",  // red-500
          dark: "#dc2626",
          light: "#fee2e2",
        },
      },
    },
  },
  plugins: [],
};

export default config;

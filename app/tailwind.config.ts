import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        leaf: {
          50: "#f2f8f1",
          100: "#e0efdd",
          200: "#c2dfbe",
          300: "#96c790",
          400: "#67a961",
          500: "#468c40",
          600: "#347030",
          700: "#2a5928",
          800: "#244722",
          900: "#1e3b1d",
          950: "#0f200f",
        },
        sand: {
          50: "#faf8f2",
          100: "#f3eede",
          200: "#e6dbbc",
        },
      },
      borderRadius: {
        "2xl": "1.25rem",
      },
    },
  },
  plugins: [],
};
export default config;

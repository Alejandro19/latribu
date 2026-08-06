import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: "#FBF7F1",
        paper: "#FFFFFF",
        ink: "#2B2420",
        "ink-soft": "#6B6058",
        terracota: {
          DEFAULT: "#C1662F",
          soft: "#F1DDCB",
        },
        sage: {
          DEFAULT: "#6B8F71",
          soft: "#E3EDE3",
        },
        gold: "#D9A441",
        line: "#E9E1D6",
        danger: "#C1462F",
        "ring-morning": "#D9A441",
        "ring-afternoon": "#5B7A4E",
        "ring-evening": "#8A5FA0",
        neutral: {
          bg: "#F5F1E9",
          line: "#E7DFC9",
          accent: "#B8935A",
        },
        green: {
          bg: "#EFF5E8",
          line: "#D9E4CE",
          accent: "#5B7A4E",
        },
      },
      fontFamily: {
        serif: ["Fraunces", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        default: "16px",
      },
    },
  },
  plugins: [],
};

export default config;

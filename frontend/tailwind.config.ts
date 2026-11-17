import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "bg-0": "#0B0E11",
        "bg-1": "#12171B",
        "bg-2": "#1A2127",
        line: "#26303A",
        "text-0": "#E6EBEF",
        "text-1": "#9AA7B2",
        "text-2": "#66727D",
        film: "#C9D4DB",
        critical: "#FF4D4F",
        urgent: "#F2A33A",
        routine: "#4FB3A5",
        review: "#8E9AF0",
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      borderRadius: {
        sm: "2px",
        DEFAULT: "4px",
      },
      spacing: {
        "4.5": "18px",
      },
    },
  },
  plugins: [],
};

export default config;

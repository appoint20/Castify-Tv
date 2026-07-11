/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      colors: {
        nflix: {
          bg: "#141414",
          card: "#181818",
          surface: "#2F2F2F",
          red: "#E50914",
          redHover: "#F40612",
          gray: "#B3B3B3",
          muted: "#808080",
        },
      },
      fontFamily: {
        heading: ["Outfit", "sans-serif"],
        body: ["Manrope", "sans-serif"],
      },
      animation: {
        fadeIn: "fadeIn 400ms ease-out both",
        fadeUp: "fadeUp 500ms cubic-bezier(0.16,1,0.3,1) both",
        scaleIn: "scaleIn 250ms cubic-bezier(0.16,1,0.3,1) both",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: 0 }, "100%": { opacity: 1 } },
        fadeUp: {
          "0%": { opacity: 0, transform: "translateY(16px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: 0, transform: "scale(0.96)" },
          "100%": { opacity: 1, transform: "scale(1)" },
        },
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        sidebar: "#111111",
        mainbg: "#1a1a1a",
        panel: "#252525",
        accent: "#0078d4",
        live: "#e81123",
      }
    },
  },
  plugins: [],
}
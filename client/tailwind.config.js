/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "#00a884",
        "primary-dark": "#008f6f",
        whatsapp: {
          green: "#00a884",
          "green-dark": "#008f6f",
          "green-light": "#d9fdd3",
          teal: "#005c4b",
          gray: "#f0f2f5",
          "gray-dark": "#202c33",
        },
      },
      fontFamily: {
        sans: [
          "Segoe UI",
          "Helvetica Neue",
          "Helvetica",
          "Lucida Grande",
          "Arial",
          "Ubuntu",
          "Cantarell",
          "Fira Sans",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

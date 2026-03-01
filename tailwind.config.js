/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "#020817",
        foreground: "#e5e7eb",
        sidebar: "#020617",
        card: "#020617",
        muted: "#1f2933",
        accent: "#2563eb",
        accentSoft: "#1d4ed8"
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.25rem"
      }
    }
  },
  plugins: []
};


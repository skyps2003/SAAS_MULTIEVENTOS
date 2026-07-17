/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#FAFAFA',
        foreground: '#18181B',
        border: '#E4E4E7',
      },
      fontFamily: {
        sans: ['"Inter"', 'sans-serif'],
        title: ['"Manrope"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--color-fondo)',
        foreground: 'var(--color-texto-primario)',
        primary: {
          100: 'var(--color-primario-100)',
          200: 'var(--color-primario-200)',
          500: 'var(--color-primario-500)',
          700: 'var(--color-primario-700)',
        },
        secondary: {
          600: 'var(--color-secundario-600)',
        },
        accent: {
          500: 'var(--color-acento-500)',
        },
        error: '#EF4444',
        success: '#22C55E',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

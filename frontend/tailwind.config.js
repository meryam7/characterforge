/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Figtree', 'system-ui', 'sans-serif'],
        display: ['Unbounded', 'Figtree', 'sans-serif'],
      },
      colors: { ink: { 950: '#0b0614', 900: '#120a20', 800: '#1a102e' } },
      boxShadow: { glow: '0 0 36px -8px rgba(168,85,247,.6)' },
    },
  },
  plugins: [],
}

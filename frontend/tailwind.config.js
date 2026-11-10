import colors from 'tailwindcss/colors'

/** Theme-aware colours are CSS variables (RGB triplets) defined in src/index.css for the dark and light themes,
 * so every existing class (bg-ink-950, text-violet-300/70, border-white/10...) follows the selected theme. */
const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Figtree', 'system-ui', 'sans-serif'],
        display: ['Unbounded', 'Figtree', 'sans-serif'],
      },
      colors: {
        ink: { 950: v('ink-950'), 900: v('ink-900'), 800: v('ink-800') },
        // "white" is the overlay/foreground colour: white on the dark theme, deep violet on the light theme.
        // Use bg-[#fff] / text-[#fff] where a real white is needed (image backdrops, text on the purple button).
        white: v('fg'),
        violet: { ...colors.violet, 50: v('violet-50'), 100: v('violet-100'), 200: v('violet-200'), 300: v('violet-300') },
      },
      boxShadow: { glow: '0 0 36px -8px rgba(168,85,247,.6)' },
    },
  },
  plugins: [],
}

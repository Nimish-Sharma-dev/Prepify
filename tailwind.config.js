/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#2454A6',
          50: '#EEF3FA',
          100: '#DCE7F5',
          500: '#2454A6',
          600: '#1E4488',
          700: '#18366B',
        },
        ink: {
          900: '#171A21',
          700: '#3A3F4B',
          500: '#6B7180',
          300: '#B0B4BE',
        },
        line: '#E4E6EB',
        surface: '#FAFAFA',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '8px',
      },
    },
  },
  plugins: [],
}

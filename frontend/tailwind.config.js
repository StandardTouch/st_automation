/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          red: '#ED1D24',
          black: '#000000',
          white: '#FFFFFF',
          grey: '#818285',
        },
        accent: { DEFAULT: '#c4161c', hover: '#a81218', soft: '#fdecec' },
      },
      fontFamily: {
        sans: ['Montserrat', 'system-ui', 'sans-serif'],
        heading: ['Poppins', 'system-ui', 'sans-serif'],
      },
      borderRadius: { lg: '6px', xl: '8px', '2xl': '10px', '3xl': '12px' },
      fontSize: {
        micro: ['12px', { lineHeight: '1.4' }],
        caption: ['13px', { lineHeight: '1.4' }],
        label: ['14px', { lineHeight: '1.4' }],
      },
      boxShadow: {
        'glow-red': '0 4px 20px -2px rgba(237, 29, 36, 0.25)',
        'soft': '0 2px 10px rgba(0, 0, 0, 0.05)',
      }
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#4F46E5',
        'primary-hover': '#4338CA',
        secondary: '#10B981',
        surface: '#FFFFFF',
        sidebar: '#141736',
        'sidebar-hover': 'rgba(255,255,255,0.1)',
        bgBody: '#F4F7FE',
        textMain: '#1E293B',
        textMuted: '#64748B',
        borderLight: '#E2E8F0',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 4px 15px rgba(0, 0, 0, 0.03)',
        'float': '0 10px 25px rgba(15, 23, 42, 0.05)',
        'glow': '0 4px 15px rgba(79, 70, 229, 0.4)',
      }
    },
  },
  plugins: [],
}
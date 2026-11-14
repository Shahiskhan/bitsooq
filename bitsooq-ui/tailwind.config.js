/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#FFFFFF',
        panel: '#FFFFFF',
        'panel-2': '#F8FAFC',
        line: '#E5EAF0',
        cyan: { neon: '#F85606' },
        purple: { neon: '#C47B2C' },
        emerald: { neon: '#16875D' },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        arabic: ['Cairo', 'Tajawal', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 18px -6px rgba(248, 86, 6, 0.24)',
        'glow-purple': '0 0 18px -6px rgba(196, 123, 44, 0.24)',
      },
      backdropBlur: { glass: '14px' },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { 50:'#fef2f2',100:'#fee2e2',500:'#e11d48',600:'#be123c',700:'#9f1239',900:'#111827' },
        ink: '#16161a',
        paper: '#fafaf9'
      },
      fontFamily: { sans: ['Inter','system-ui','sans-serif'] }
    }
  },
  plugins: []
};

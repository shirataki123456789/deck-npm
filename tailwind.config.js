/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'card-red': '#AC1122',
        'card-green': '#008866',
        'card-blue': '#0084BD',
        'card-purple': '#93388B',
        'card-black': '#211818',
        'card-yellow': '#F7E731',
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#001E62',
          800: '#00287a',
          700: '#003090',
        },
      },
    },
  },
  plugins: [],
};

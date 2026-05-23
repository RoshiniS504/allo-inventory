/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#EBF4FF',
          500: '#0F6FBF',
          600: '#0A5599',
        },
        accent: {
          50:  '#E6F8F5',
          500: '#00B89F',
          600: '#009B85',
        },
        surface: '#F0F4F8',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'sans-serif'],
        display: ['var(--font-dm-sans)', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'monospace'],
      }
    }
  },
  plugins: []
};

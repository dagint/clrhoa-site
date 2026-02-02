/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        'clr-green': '#1e5f38', // Deep lake green
        'clr-beige': '#f4e8d9', // Warm sand beige
        'clr-orange': '#d97706', // Florida orange
        'clr-gray': '#6b7280',
      },
      fontFamily: {
        heading: ['"Playfair Display"', 'serif'],
        body: ['Inter', '"Open Sans"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

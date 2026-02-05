/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        'clr-green': '#1e5f38', // Deep lake green
        'clr-beige': '#f4e8d9', // Warm sand beige
        'clr-orange': '#92400e', // Florida orange (darkened for WCAG AA: white on orange + orange on white)
        'clr-gray': '#4b5563', // Darker gray for WCAG AA on white cards
      },
      fontFamily: {
        heading: ['"Playfair Display"', 'serif'],
        body: ['Inter', '"Open Sans"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

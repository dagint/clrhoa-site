import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        'clr-green': '#1e5f38',
        'clr-beige': '#f4e8d9',
        'clr-orange': '#92400e',
        'clr-gray': '#4b5563',
      },
      fontFamily: {
        heading: ['"Playfair Display"', 'serif'],
        body: ['Inter', '"Open Sans"', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;

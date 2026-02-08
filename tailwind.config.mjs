/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class', // Portal dark mode uses html.dark; Tailwind dark: variants align with it
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
      // Portal dark theme: CSS vars in theme.css (--text-primary-dark, --portal-*). dark: variants use class .dark on html.
      borderColor: {
        'portal-card': 'var(--portal-card-border)',
        'portal-input': 'var(--portal-input-border)',
      },
      backgroundColor: {
        'portal-card': 'var(--portal-card-bg)',
        'portal-input': 'var(--portal-input-bg)',
      },
      textColor: {
        'portal-primary': 'var(--portal-text)',
        'portal-muted': 'var(--portal-text-muted)',
        'portal-primary-dark': 'var(--text-primary-dark)',
        'portal-muted-dark': 'var(--text-muted-dark)',
      },
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        'cream': '#F8F5F0',
        'sage': '#6B8E7B',
        'orange': {
          DEFAULT: '#D35400',
          light: '#E67E22',
          dark: '#BA4A00',
        },
      },
      fontFamily: {
        'sans': ['Inter', 'system-ui', 'sans-serif'],
        'serif': ['Lora', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}

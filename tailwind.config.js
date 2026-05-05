/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Heebo', 'system-ui', 'sans-serif'],
        display: ['Rubik', 'Heebo', 'sans-serif'],
      },
      colors: {
        // Brand colors - now theme-aware. Each shade reads from a CSS variable
        // (--brand-50, --brand-500, etc.) that the ThemeProvider sets per workspace.
        // The fallback (after the comma) is the original purple, used when no
        // theme is active (login page, public pages, etc.) or when a theme
        // doesn't override that specific shade.
        //
        // This means existing className="bg-brand-500" automatically picks up
        // the workspace's primary color without any code changes — beauty
        // workspaces become rose, finance becomes navy, etc.
        brand: {
          50:  'rgb(var(--brand-50)  / <alpha-value>)',
          100: 'rgb(var(--brand-100) / <alpha-value>)',
          400: 'rgb(var(--brand-400) / <alpha-value>)',
          500: 'rgb(var(--brand-500) / <alpha-value>)',
          600: 'rgb(var(--brand-600) / <alpha-value>)',
          700: 'rgb(var(--brand-700) / <alpha-value>)',
          900: 'rgb(var(--brand-900) / <alpha-value>)',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        // Landing-page polish animations:
        // - float: gentle vertical bobbing for hero mockup + decorative orbs
        // - blob: organic morphing for background gradient blobs
        // - gradient-shift: slow background-position shift for hero
        // - pulse-soft: gentler heartbeat than tailwind's animate-pulse
        // - fade-in-up: slower, more graceful entrance (use w/ animation-delay)
        'float': 'float 6s ease-in-out infinite',
        'float-slow': 'float 9s ease-in-out infinite',
        'blob': 'blob 14s ease-in-out infinite',
        'gradient-shift': 'gradientShift 15s ease infinite',
        'pulse-soft': 'pulseSoft 3s ease-in-out infinite',
        'fade-in-up': 'fadeInUp 0.7s ease-out backwards',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        blob: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%':       { transform: 'translate(30px, -40px) scale(1.1)' },
          '66%':       { transform: 'translate(-20px, 20px) scale(0.95)' },
        },
        gradientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%':      { backgroundPosition: '100% 50%' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.6' },
        },
        fadeInUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

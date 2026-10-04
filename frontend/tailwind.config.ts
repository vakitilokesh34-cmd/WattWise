import type { Config } from 'tailwindcss'

/**
 * WattWise design tokens.
 * Dark futuristic enterprise UI — glass surfaces, soft luminous borders,
 * restrained accent palette (cyan = normal, amber = warning, rose = critical).
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: {
          950: '#04070d',
          900: '#070b14',
          850: '#0a0f1b',
          800: '#0e1523',
          750: '#131b2c',
          700: '#1a2336',
          600: '#253148',
          500: '#37455f',
        },
        ink: {
          50: '#f5f8ff',
          100: '#e6ecfa',
          200: '#c3cee6',
          300: '#94a3c4',
          400: '#6c7b9f',
          500: '#4d5b7c',
        },
        flux: {
          50: '#ecfeff',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
        },
        watt: {
          300: '#a7f3d0',
          400: '#34d399',
          500: '#10b981',
        },
        alert: {
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
        },
        crit: {
          300: '#fda4af',
          400: '#fb7185',
          500: '#f43f5e',
          600: '#e11d48',
        },
        iris: {
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
        },
      },
      fontFamily: {
        sans: [
          'Inter var',
          'Inter',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'sans-serif',
        ],
        mono: ['JetBrains Mono', 'SFMono-Regular', 'Consolas', 'Liberation Mono', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        glass: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 24px 60px -32px rgba(0,0,0,0.9)',
        'glow-flux': '0 0 0 1px rgba(34,211,238,0.28), 0 0 28px -6px rgba(34,211,238,0.42)',
        'glow-alert': '0 0 0 1px rgba(245,158,11,0.3), 0 0 30px -6px rgba(245,158,11,0.45)',
        'glow-crit': '0 0 0 1px rgba(244,63,94,0.32), 0 0 34px -6px rgba(244,63,94,0.5)',
        lift: '0 30px 70px -40px rgba(0,0,0,0.95)',
      },
      backgroundImage: {
        'grid-fade':
          'linear-gradient(to bottom, rgba(4,7,13,0) 0%, rgba(4,7,13,0.85) 78%, #04070d 100%)',
        'radial-flux': 'radial-gradient(120% 120% at 50% 0%, rgba(34,211,238,0.16) 0%, rgba(4,7,13,0) 60%)',
        'radial-iris': 'radial-gradient(100% 100% at 80% 10%, rgba(139,92,246,0.14) 0%, rgba(4,7,13,0) 55%)',
      },
      keyframes: {
        'pulse-ring': {
          '0%': { transform: 'scale(0.85)', opacity: '0.65' },
          '70%': { transform: 'scale(1.6)', opacity: '0' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scan-line': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(400%)' },
        },
        'flow-dash': {
          to: { strokeDashoffset: '-1000' },
        },
      },
      animation: {
        'pulse-ring': 'pulse-ring 2.4s cubic-bezier(0.22,1,0.36,1) infinite',
        shimmer: 'shimmer 1.8s infinite',
        'fade-up': 'fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both',
        'scan-line': 'scan-line 3.2s linear infinite',
        'flow-dash': 'flow-dash 6s linear infinite',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
} satisfies Config

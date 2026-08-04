import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          deep:    '#0A0A0A',
          panel:   '#111111',
          surface: '#1A1A1A',
          raised:  '#27272A',
        },
        border: {
          DEFAULT: '#1F1F23',
          light:   '#27272A',
        },
        text: {
          white:   '#FAFAFA',
          muted:   '#A1A1AA',
          faint:   '#52525B',
          fainter: '#3B3B3B',
        },
        brand: {
          blue:         '#3B82F6',
          'blue-deep':  '#1D3461',
          gold:         '#D4A843',
          'gold-deep':  '#2D2410',
          green:        '#22C55E',
          'green-deep': '#14291E',
          purple:       '#A855F7',
          red:          '#EF4444',
        },
      },
      fontFamily: {
        sans:   ['Inter', 'system-ui', 'sans-serif'],
        arabic: ['Cairo', 'Tajawal', 'system-ui', 'sans-serif'],
        mono:   ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        'display-2xl': ['72px', { lineHeight: '80px', letterSpacing: '-0.02em' }],
        'display-xl':  ['56px', { lineHeight: '64px', letterSpacing: '-0.02em' }],
        'display-lg':  ['44px', { lineHeight: '52px', letterSpacing: '-0.02em' }],
        'display-md':  ['36px', { lineHeight: '44px', letterSpacing: '-0.01em' }],
      },
      maxWidth: {
        '8xl': '88rem',
      },
      animation: {
        'fade-in':  'fade-in 0.5s ease-out',
        'fade-up':  'fade-up 0.6s ease-out',
        'scale-in': 'scale-in 0.4s ease-out',
      },
      keyframes: {
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-up': {
          '0%':   { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%':   { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
}

export default config

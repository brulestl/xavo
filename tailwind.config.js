/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}", "./screens/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // New Theme Colors
        'user-bubble': '#0071fc',
        'assistant-bubble': '#cfdbd5',
        'file-upload-bubble': '#f5cb5c',
        'composer-light': '#e8eddf',
        'composer-dark': '#333533',
        'background-light': '#FFFFFF',
        'background-dark': '#242423',
        
        // Xavo Brand Colors (Legacy)
        'xavo-blue': '#4285F4',
        'growth-green': '#1DB954',
        'pure-white': '#FFFFFF',
        'deep-navy': '#011C27',
        'nearly-black': '#1A1A1A',
        'muted-accent': '#4285F466',
        
        // Legacy colors (for backward compatibility)
        platinum: '#CFDBD5',
        alabaster: '#E8EDDF', 
        saffron: '#F5CB5C',
        'eerie-black': '#242423',
        jet: '#333533',
        
        // Semantic mappings for Xavo
        primary: {
          DEFAULT: '#4285F4', // xavo-blue
          disabled: '#4285F466', // 40% opacity
        },
        cta: {
          DEFAULT: '#1DB954', // growth-green
          disabled: '#1DB95466', // 40% opacity
        },
        background: {
          light: '#FFFFFF', // pure-white for light mode
          dark: '#011C27', // deep-navy for dark mode
        },
        card: {
          light: '#FFFFFF', // pure-white for light mode
          dark: '#011C27', // deep-navy for dark mode
        },
        text: {
          primary: {
            light: '#1A1A1A', // nearly-black for light mode
            dark: '#FFFFFF', // pure-white for dark mode
          },
          secondary: {
            light: '#1A1A1AAA', // nearly-black with opacity for light mode  
            dark: '#FFFFFFCC', // pure-white with opacity for dark mode
          }
        },
        surface: {
          light: '#FFFFFF',
          dark: '#011C27', // deep-navy
        },
        border: {
          light: '#1A1A1A10', // nearly-black with low opacity
          dark: '#FFFFFF20', // pure-white with low opacity
        }
      },
      borderRadius: {
        'xavo': '12px', // Xavo's 12px radius
        'button': '999px', // rounded-full for pill buttons
      },
      fontSize: {
        'button': ['16px', { fontWeight: '600' }], // 16px semibold for buttons
      },
      fontWeight: {
        'slim': '300', // For Xavo logo
      },
      animation: {
        'fade-slide': 'fadeSlide 250ms ease-in-out',
      },
      keyframes: {
        fadeSlide: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
}
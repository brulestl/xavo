/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}", "./screens/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Theme tokens
        platinum: '#CFDBD5',
        alabaster: '#E8EDDF', 
        saffron: '#F5CB5C',
        'eerie-black': '#242423',
        jet: '#333533',
        
        // Semantic mappings
        primary: {
          DEFAULT: '#F5CB5C', // saffron
          disabled: '#F5CB5C66', // 40% opacity
        },
        background: {
          light: '#E8EDDF', // alabaster for light mode
          dark: '#242423', // eerieBlack for dark mode
        },
        card: {
          light: '#CFDBD5', // platinum for light mode
          dark: '#CFDBD5', // platinum for dark mode
        },
        text: {
          primary: {
            light: '#242423', // eerieBlack for light mode
            dark: '#E8EDDF', // alabaster for dark mode
          },
          secondary: {
            light: '#333533', // jet for light mode  
            dark: '#CFDBD5', // platinum for dark mode
          }
        },
        surface: {
          light: '#FFFFFF',
          dark: '#333533', // jet
        },
        border: {
          light: '#CFDBD5', // platinum
          dark: '#333533', // jet
        }
      },
      borderRadius: {
        'button': '999px', // rounded-full for primary buttons
      },
      fontSize: {
        'button': ['16px', { fontWeight: 'bold' }], // 16px bold for buttons
      }
    },
  },
  plugins: [],
}
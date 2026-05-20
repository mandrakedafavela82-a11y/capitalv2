import { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext(null)
const THEMES = ['dark', 'light', 'sepia']

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('ccTheme') || 'dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('ccTheme', theme)
  }, [theme])

  const toggleTheme = () => {
    const idx = THEMES.indexOf(theme)
    setTheme(THEMES[(idx + 1) % THEMES.length])
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)

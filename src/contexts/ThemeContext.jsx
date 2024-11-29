/**
 * Theme Context and Provider
 * 
 * Manages the application's theme state (dark/light mode) with the following features:
 * - Persists theme preference in localStorage
 * - Respects system color scheme preference by default
 * - Provides a hook for consuming theme state and toggle function
 * - Automatically updates document classes for Tailwind dark mode
 */

import React, { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext()

/**
 * Custom hook to access theme context
 * @returns {{darkMode: boolean, toggleTheme: Function}} Theme context value
 * @throws {Error} When used outside of ThemeProvider
 */
export function useTheme() {
  return useContext(ThemeContext)
}

/**
 * Theme Provider Component
 * 
 * Provides theme context to the application with automatic system preference detection
 * and local storage persistence.
 * 
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 * @returns {React.ReactElement} Provider component
 * 
 * @example
 * <ThemeProvider>
 *   <App />
 * </ThemeProvider>
 */
export function ThemeProvider({ children }) {
  const [darkMode, setDarkMode] = useState(() => {
    // Check local storage first
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme) {
      return savedTheme === 'dark'
    }
    // If no saved theme, check system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    // Update localStorage and document class when theme changes
    localStorage.setItem('theme', darkMode ? 'dark' : 'light')
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  const toggleTheme = () => {
    setDarkMode(prev => !prev)
  }

  const value = {
    darkMode,
    toggleTheme
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

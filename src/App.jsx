/**
 * Main application component for RummageSale.Live
 * This file serves as the root component and handles routing, authentication,
 * theming, and the main navigation structure of the application.
 */

// React and routing
import React, { useState, useCallback, useEffect, lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'

// Context providers
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'

// Components
import PrivateRoute from './components/PrivateRoute'
import ScrollToTop from './components/ScrollToTop'
import Loading from './components/Loading'

// Icons and assets
import { HiMenu, HiX, HiSun, HiMoon } from 'react-icons/hi'
import favicon from '/favicon.svg'

/**
 * NavigationBar component that provides the main navigation interface
 * Features:
 * - Responsive design with mobile menu
 * - Dynamic links based on user authentication state
 * - Theme toggle functionality
 * - Admin-specific navigation items
 */
function NavigationBar() {
  const { currentUser, logout, isAdmin } = useAuth()
  const { darkMode, toggleTheme } = useTheme()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const handleLogout = useCallback(async (e) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      await logout()
      setIsMenuOpen(false)
    } catch (error) {
      console.error('Failed to log out:', error)
    }
  }, [logout])

  const toggleMenu = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsMenuOpen(prev => !prev)
  }, [])

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false)
  }, [])

  const handleThemeToggle = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    toggleTheme()
  }, [toggleTheme])

  // Close menu when clicking outside
  useEffect(() => {
    if (!isMenuOpen) return

    const handleClickOutside = (event) => {
      const nav = document.getElementById('main-nav')
      if (nav && !nav.contains(event.target)) {
        setIsMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isMenuOpen])

  const baseButtonClass = darkMode
    ? "bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white"
    : "bg-white text-gray-700 hover:bg-gray-100 hover:text-gray-900";

  const buttonClass = `${baseButtonClass} px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 cursor-pointer`;

  const NavLinks = useCallback(() => (
    <>
      {currentUser ? (
        <>
          <Link
            to="/my-sales"
            className={buttonClass}
            onClick={closeMenu}
          >
            My Sales
          </Link>
          {isAdmin && (
            <Link
              to="/event-types"
              className={buttonClass}
              onClick={closeMenu}
            >
              Manage Event Types
            </Link>
          )}
          {isAdmin && (
            <Link
              to="/admin"
              className={buttonClass}
              onClick={closeMenu}
            >
              Admin Management
            </Link>
          )}
          {isAdmin && (
            <Link
              to="/analytics"
              className={buttonClass}
              onClick={closeMenu}
            >
              Analytics
            </Link>
          )}
          <button
            onClick={handleLogout}
            className={buttonClass}
          >
            Log Out
          </button>
        </>
      ) : (
        <>
          <Link
            to="/login"
            className={buttonClass}
            onClick={closeMenu}
          >
            Log In
          </Link>
          <Link
            to="/signup"
            className={buttonClass}
            onClick={closeMenu}
          >
            Sign Up
          </Link>
        </>
      )}
    </>
  ), [currentUser, isAdmin, buttonClass, closeMenu, handleLogout])

  return (
    <nav id="main-nav" className={`${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-md transition-colors duration-200 fixed top-0 left-0 right-0 z-50`}>
      <div className="relative w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2 z-50" onClick={closeMenu}>
              <img src={favicon} alt="RummageSale.Live logo" className="w-8 h-8" />
              <span className={`${darkMode ? 'text-white' : 'text-gray-900'} font-bold text-xl`}>
                RummageSale.Live
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4 z-50">
            <NavLinks />
            <button
              onClick={handleThemeToggle}
              className={`${buttonClass} inline-flex items-center`}
              aria-label="Toggle theme"
            >
              {darkMode ? <HiSun className="h-5 w-5" /> : <HiMoon className="h-5 w-5" />}
            </button>
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden items-center space-x-2 z-50">
            <button
              onClick={handleThemeToggle}
              className={buttonClass}
              aria-label="Toggle theme"
            >
              {darkMode ? <HiSun className="w-5 h-5" /> : <HiMoon className="w-5 h-5" />}
            </button>
            <button
              onClick={toggleMenu}
              className={buttonClass}
              aria-label="Toggle menu"
            >
              {isMenuOpen ? <HiX className="w-6 h-6" /> : <HiMenu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div 
          className={`md:hidden transition-all duration-200 ease-in-out absolute top-full left-0 right-0 z-40 ${
            isMenuOpen 
              ? 'opacity-100 translate-y-0' 
              : 'opacity-0 -translate-y-2 pointer-events-none'
          } w-full ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg`}
        >
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            <NavLinks />
          </div>
        </div>
      </div>
    </nav>
  )
}

/**
 * Root App component that sets up the application structure
 * Includes:
 * - Router configuration
 * - Context providers for auth and theming
 * - Main layout structure
 * - Protected routes for authenticated features
 */
const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const SignUp = lazy(() => import('./pages/SignUp'));
const MySales = lazy(() => import('./pages/MySales'));
const EventTypes = lazy(() => import('./pages/EventTypes'));
const AdminManagement = lazy(() => import('./pages/AdminManagement'));
const Analytics = lazy(() => import('./pages/Analytics'));

function App() {
  return (
    <Router>
      <AuthProvider>
        <ThemeProvider>
          <div className="min-h-screen">
            <ScrollToTop />
            <NavigationBar />
            <div className="pt-16">
              <main className="flex-1 overflow-auto">
                <Suspense fallback={<Loading />}>
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<SignUp />} />
                    <Route
                      path="/my-sales"
                      element={
                        <PrivateRoute>
                          <MySales />
                        </PrivateRoute>
                      }
                    />
                    <Route
                      path="/event-types"
                      element={
                        <PrivateRoute>
                          <EventTypes />
                        </PrivateRoute>
                      }
                    />
                    <Route
                      path="/admin"
                      element={
                        <PrivateRoute>
                          <AdminManagement />
                        </PrivateRoute>
                      }
                    />
                    <Route
                      path="/analytics"
                      element={
                        <PrivateRoute>
                          <Analytics />
                        </PrivateRoute>
                      }
                    />
                  </Routes>
                </Suspense>
              </main>
            </div>
          </div>
        </ThemeProvider>
      </AuthProvider>
    </Router>
  )
}

export default App

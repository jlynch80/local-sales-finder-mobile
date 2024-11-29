/**
 * ScrollToTop Component
 * 
 * A utility component that scrolls the window to the top whenever
 * the route changes. This ensures a consistent user experience
 * when navigating between different pages.
 * 
 * This component should be placed near the root of the app,
 * typically just inside the Router component.
 * 
 * @returns {null} This component doesn't render anything
 * 
 * @example
 * <Router>
 *   <ScrollToTop />
 *   <App />
 * </Router>
 */

import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export default function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}

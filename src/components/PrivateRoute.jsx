/**
 * PrivateRoute Component
 * 
 * A wrapper component that protects routes requiring authentication.
 * If a user is not authenticated, they will be redirected to the login page.
 * 
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components to render if authenticated
 * @returns {React.ReactElement} The protected route content or redirect
 * 
 * @example
 * <PrivateRoute>
 *   <ProtectedComponent />
 * </PrivateRoute>
 */

import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function PrivateRoute({ children }) {
  const { currentUser } = useAuth()

  return currentUser ? children : <Navigate to="/login" />
}

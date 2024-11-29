/**
 * Authentication Context and Provider
 * 
 * Manages the application's authentication state using Firebase Auth with the following features:
 * - Email/password authentication
 * - Google OAuth authentication
 * - Admin role management
 * - User data persistence in Firestore
 * - Loading and error state management
 */

import React, { createContext, useContext, useState, useEffect } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
} from 'firebase/auth'
import { auth, db } from '../firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'

const AuthContext = createContext()

/**
 * Custom hook to access authentication context
 * @returns {Object} Auth context value containing:
 * - currentUser: Firebase User object
 * - isAdmin: boolean indicating admin status
 * - error: string | null containing last error
 * - signup: (email, password) => Promise
 * - login: (email, password) => Promise
 * - loginWithGoogle: () => Promise
 * - logout: () => Promise
 * @throws {Error} When used outside of AuthProvider
 */
export function useAuth() {
  return useContext(AuthContext)
}

/**
 * Authentication Provider Component
 * 
 * Provides authentication context to the application with Firebase integration
 * and admin role management.
 * 
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 * @returns {React.ReactElement} Provider component
 * 
 * @example
 * <AuthProvider>
 *   <App />
 * </AuthProvider>
 */
export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [error, setError] = useState(null)

  /**
   * Checks if the current user has admin privileges
   * @param {string} uid - User ID to check
   * @returns {Promise<void>}
   */
  async function checkAdminStatus(uid) {
    if (!uid) {
      setIsAdmin(false)
      return
    }
    
    try {
      const userDocRef = doc(db, 'users', uid)
      const userDoc = await getDoc(userDocRef)
      
      if (userDoc.exists()) {
        setIsAdmin(userDoc.data().isAdmin || false)
      } else {
        setIsAdmin(false)
      }
    } catch (error) {
      console.error('Error checking admin status:', error)
      setIsAdmin(false)
    }
  }

  /**
   * Creates a new user account with email and password
   * @param {string} email - User's email
   * @param {string} password - User's password
   * @returns {Promise<UserCredential>} Firebase user credential
   */
  async function signup(email, password) {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password)
      await setDoc(doc(db, 'users', result.user.uid), {
        email: result.user.email,
        isAdmin: false,
        createdAt: new Date(),
      })
      return result
    } catch (error) {
      console.error('Error during signup:', error)
      throw error
    }
  }

  /**
   * Signs in a user with email and password
   * @param {string} email - User's email
   * @param {string} password - User's password
   * @returns {Promise<UserCredential>} Firebase user credential
   */
  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password)
  }

  /**
   * Signs in a user with Google OAuth
   * Creates a user document if it doesn't exist
   * @returns {Promise<UserCredential>} Firebase user credential
   */
  async function loginWithGoogle() {
    try {
      setError(null)
      setLoading(true)
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({
        prompt: 'select_account'
      })

      const result = await signInWithPopup(auth, provider)

      if (result.user) {
        // Check if user document exists, if not create it
        const userDoc = await getDoc(doc(db, 'users', result.user.uid))
        if (!userDoc.exists()) {
          await setDoc(doc(db, 'users', result.user.uid), {
            email: result.user.email,
            isAdmin: false,
            createdAt: new Date(),
          })
        }
        await checkAdminStatus(result.user.uid)
      }
      
      return result
    } catch (error) {
      console.error('Error during Google sign-in:', error)
      setError(error.message)
      throw error
    } finally {
      setLoading(false)
    }
  }

  /**
   * Signs out the current user
   * @returns {Promise<void>}
   */
  function logout() {
    setIsAdmin(false)
    return signOut(auth)
  }

  // Set up authentication state observer
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user)
        await checkAdminStatus(user.uid)
      } else {
        setCurrentUser(null)
        setIsAdmin(false)
      }
      setLoading(false)
    })

    return unsubscribe
  }, [])

  const value = {
    currentUser,
    isAdmin,
    error,
    signup,
    login,
    loginWithGoogle,
    logout,
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

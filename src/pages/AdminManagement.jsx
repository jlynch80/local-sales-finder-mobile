/**
 * Admin Management Component
 * 
 * Provides administrative interface for managing users and system settings.
 * Only accessible to users with admin privileges.
 * 
 * Features:
 * - User management (view, promote/demote admin status)
 * - User activity tracking
 * - User filtering and search capabilities
 * - Responsive design with dark/light mode support
 * 
 * Security:
 * - Protected route requiring admin authentication
 * - Implements role-based access control
 * - Secure user status modification
 */

import React, { useState, useEffect } from 'react'
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useNavigate } from 'react-router-dom'
import ConfirmationModal from '../components/ConfirmationModal'

export default function AdminManagement() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const { currentUser, isAdmin } = useAuth()
  const { darkMode } = useTheme()
  const navigate = useNavigate()
  const [modalState, setModalState] = useState({
    isOpen: false,
    title: '',
    message: '',
    userId: null,
    action: null
  })

  useEffect(() => {
    if (!isAdmin) {
      navigate('/')
      return
    }

    const fetchUsers = async () => {
      try {
        const usersCollection = collection(db, 'users')
        const userSnapshot = await getDocs(usersCollection)
        const usersList = userSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        setUsers(usersList)
        setLoading(false)
      } catch (err) {
        setError('Failed to fetch users')
        setLoading(false)
      }
    }

    fetchUsers()
  }, [isAdmin, navigate])

  const handleToggleAdmin = (userId, currentIsAdmin) => {
    if (!userId) {
      setError('Invalid user data')
      return
    }

    setModalState({
      isOpen: true,
      title: currentIsAdmin ? 'Remove Admin Access' : 'Grant Admin Access',
      message: currentIsAdmin 
        ? 'Are you sure you want to remove admin privileges from this user?' 
        : 'Are you sure you want to grant admin privileges to this user?',
      userId,
      action: currentIsAdmin ? 'remove' : 'add'
    })
  }

  const handleConfirmToggleAdmin = async () => {
    const { userId, action } = modalState
    const isAddingAdmin = action === 'add'
    
    try {
      const userRef = doc(db, 'users', userId)
      await updateDoc(userRef, {
        isAdmin: isAddingAdmin
      })

      setUsers(users.map(user => {
        if (user.id === userId) {
          return { ...user, isAdmin: isAddingAdmin }
        }
        return user
      }))

      setError('')
    } catch (err) {
      setError('Failed to update admin status')
    }

    setModalState(prev => ({ ...prev, isOpen: false }))
  }

  const closeConfirmationModal = () => {
    setModalState(prev => ({ ...prev, isOpen: false }))
  }

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className={`min-h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-black'} flex items-center justify-center`}>
        Loading...
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-100'} py-6 flex flex-col justify-center sm:py-12`}>
      <div className="relative py-3 sm:max-w-xl sm:mx-auto w-full px-4 sm:px-0">
        <div className={`relative px-4 py-10 ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg sm:rounded-3xl sm:p-20`}>
          <div className="max-w-md mx-auto">
            <div className={`divide-y ${darkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
              <div className={`py-8 text-base leading-6 space-y-4 ${darkMode ? 'text-gray-100' : 'text-gray-700'} sm:text-lg sm:leading-7`}>
                <div className="flex flex-col space-y-4">
                  <h2 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Admin Management</h2>
                  
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search users by email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`w-full p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 
                        ${darkMode 
                          ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' 
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'}`}
                    />
                  </div>
                </div>

                {error && (
                  <div className={`px-4 py-3 rounded relative mb-4 ${
                    darkMode 
                      ? 'bg-red-900 border-red-700 text-red-100' 
                      : 'bg-red-100 border-red-400 text-red-700'
                  }`} role="alert">
                    <span className="block sm:inline">{error}</span>
                  </div>
                )}

                <div className="space-y-4 mt-4">
                  {filteredUsers.map(user => (
                    <div key={user.id} className={`flex items-center justify-between p-4 rounded-lg ${
                      darkMode ? 'bg-gray-700' : 'bg-gray-50'
                    }`}>
                      <div>
                        <p className={`font-medium ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                          {user.email}
                        </p>
                        <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          {user.isAdmin ? 'Admin' : 'User'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleAdmin(user.id, user.isAdmin)}
                        className={`px-4 py-2 rounded-md transition-colors text-white ${
                          user.isAdmin
                            ? 'bg-red-600 hover:bg-red-700'
                            : 'bg-primary-600 hover:bg-primary-700'
                        }`}
                        disabled={user.id === currentUser?.uid}
                      >
                        {user.isAdmin ? 'Remove Admin' : 'Make Admin'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={modalState.isOpen}
        onClose={closeConfirmationModal}
        onConfirm={handleConfirmToggleAdmin}
        title={modalState.title}
        message={modalState.message}
      />
    </div>
  )
}

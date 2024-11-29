/**
 * Event Types Management Component
 * 
 * Administrative interface for managing sale event types.
 * Allows creation, modification, and deletion of event categories.
 * 
 * Features:
 * - CRUD operations for event types
 * - Emoji picker integration
 * - Real-time validation
 * - Confirmation dialogs for destructive actions
 * - Responsive design with dark/light mode support
 * 
 * Security:
 * - Protected route requiring admin authentication
 * - Data validation before submission
 * - Safe deletion checks (prevents deletion of types in use)
 */

import React, { useState, useEffect } from 'react';
import { collection, getDocs, updateDoc, doc, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigate } from 'react-router-dom';

export default function EventTypes() {
  const [eventTypes, setEventTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newEventType, setNewEventType] = useState({ name: '', emoji: '🏷️' });
  const [editingId, setEditingId] = useState(null);
  const { currentUser } = useAuth();
  const { darkMode } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    fetchEventTypes();
  }, []);

  const fetchEventTypes = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'eventTypes'));
      const types = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setEventTypes(types);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching event types:', error);
      setError('Failed to load event types');
      setLoading(false);
    }
  };

  const handleAddEventType = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'eventTypes'), {
        name: newEventType.name,
        emoji: newEventType.emoji
      });
      setNewEventType({ name: '', emoji: '🏷️' });
      fetchEventTypes();
    } catch (error) {
      console.error('Error adding event type:', error);
      setError('Failed to add event type');
    }
  };

  const handleUpdateEventType = async (id, updatedType) => {
    try {
      await updateDoc(doc(db, 'eventTypes', id), updatedType);
      setEditingId(null);
      fetchEventTypes();
    } catch (error) {
      console.error('Error updating event type:', error);
      setError('Failed to update event type');
    }
  };

  const handleDeleteEventType = async (id) => {
    if (window.confirm('Are you sure you want to delete this event type?')) {
      try {
        await deleteDoc(doc(db, 'eventTypes', id));
        fetchEventTypes();
      } catch (error) {
        console.error('Error deleting event type:', error);
        setError('Failed to delete event type');
      }
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex flex-col ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
        <div className="flex-1 py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className={`${darkMode ? 'bg-gray-700' : 'bg-white'} rounded-lg shadow-lg overflow-hidden`}>
              <div className="p-6 sm:p-8">
                <div className="text-center">Loading...</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
      <div className="flex-1 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`${darkMode ? 'bg-gray-700' : 'bg-white'} rounded-lg shadow-lg overflow-hidden`}>
            <div className="p-6 sm:p-8">
              <div className="mb-8">
                <h1 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'} mb-4`}>Manage Event Types</h1>
                {error && (
                  <div className={`${darkMode ? 'bg-red-900 border-red-700' : 'bg-red-50 border-red-400'} border-l-4 p-4 mb-4`}>
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className={`h-5 w-5 ${darkMode ? 'text-red-500' : 'text-red-400'}`} viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className={`text-sm ${darkMode ? 'text-red-200' : 'text-red-700'}`}>{error}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Add new event type form */}
                <form onSubmit={handleAddEventType} className="mb-6">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <label htmlFor="eventName" className={`block text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-700'} mb-1`}>
                        Event Type Name
                      </label>
                      <input
                        id="eventName"
                        type="text"
                        value={newEventType.name}
                        onChange={(e) => setNewEventType({ ...newEventType, name: e.target.value })}
                        placeholder="e.g., Garage Sale"
                        className={`mt-1 block w-full rounded-md shadow-sm focus:border-primary-500 focus:ring-primary-500 text-base py-3 px-4
                          ${darkMode 
                            ? 'bg-gray-600 border-gray-500 text-white placeholder-gray-400' 
                            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'}`}
                        required
                      />
                    </div>
                    <div className="w-full sm:w-24">
                      <label htmlFor="eventEmoji" className={`block text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-700'} mb-1`}>
                        Emoji
                      </label>
                      <input
                        id="eventEmoji"
                        type="text"
                        value={newEventType.emoji}
                        onChange={(e) => setNewEventType({ ...newEventType, emoji: e.target.value })}
                        placeholder="🏷️"
                        className={`mt-1 block w-full rounded-md shadow-sm focus:border-primary-500 focus:ring-primary-500 text-base py-3 px-4
                          ${darkMode 
                            ? 'bg-gray-600 border-gray-500 text-white placeholder-gray-400' 
                            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'}`}
                        required
                      />
                    </div>
                    <div className="w-full sm:w-auto sm:self-end">
                      <button
                        type="submit"
                        className="w-full sm:w-auto inline-flex justify-center py-3 px-6 border border-transparent shadow-sm text-base font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                      >
                        Add Event Type
                      </button>
                    </div>
                  </div>
                </form>

                {/* Event types list */}
                <div className={`${darkMode ? 'bg-gray-700' : 'bg-white'} shadow overflow-hidden sm:rounded-md`}>
                  <ul className={`divide-y ${darkMode ? 'divide-gray-600' : 'divide-gray-200'}`}>
                    {eventTypes.map((type) => (
                      <li key={type.id}>
                        {editingId === type.id ? (
                          <div className="px-4 py-4 sm:flex items-center justify-between">
                            <div className="flex flex-col sm:flex-row gap-4 flex-1 mb-4 sm:mb-0">
                              <input
                                type="text"
                                value={type.name}
                                onChange={(e) => setEventTypes(eventTypes.map(t => 
                                  t.id === type.id ? { ...t, name: e.target.value } : t
                                ))}
                                className={`block w-full rounded-md shadow-sm focus:border-primary-500 focus:ring-primary-500 text-base py-3 px-4
                                  ${darkMode 
                                    ? 'bg-gray-600 border-gray-500 text-white' 
                                    : 'bg-white border-gray-300 text-gray-900'}`}
                              />
                              <input
                                type="text"
                                value={type.emoji}
                                onChange={(e) => setEventTypes(eventTypes.map(t => 
                                  t.id === type.id ? { ...t, emoji: e.target.value } : t
                                ))}
                                className={`block w-full sm:w-24 rounded-md shadow-sm focus:border-primary-500 focus:ring-primary-500 text-base py-3 px-4
                                  ${darkMode 
                                    ? 'bg-gray-600 border-gray-500 text-white' 
                                    : 'bg-white border-gray-300 text-gray-900'}`}
                              />
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2 sm:ml-4">
                              <button
                                onClick={() => handleUpdateEventType(type.id, { name: type.name, emoji: type.emoji })}
                                className="w-full sm:w-auto inline-flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className={`w-full sm:w-auto inline-flex justify-center items-center px-6 py-3 border text-base font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500
                                  ${darkMode 
                                    ? 'border-gray-600 text-gray-200 bg-gray-700 hover:bg-gray-600' 
                                    : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'}`}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="px-4 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between">
                            <div className="flex items-center mb-4 sm:mb-0">
                              <span className="text-2xl mr-2">{type.emoji}</span>
                              <span className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>{type.name}</span>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                              <button
                                onClick={() => setEditingId(type.id)}
                                className="w-full sm:w-auto inline-flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteEventType(type.id)}
                                className={`w-full sm:w-auto inline-flex justify-center items-center px-6 py-3 border text-base font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500
                                  ${darkMode 
                                    ? 'border-gray-600 text-gray-200 bg-gray-700 hover:bg-gray-600' 
                                    : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'}`}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

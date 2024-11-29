/**
 * @fileoverview Firebase configuration and initialization module.
 * This module sets up Firebase services including Authentication, Firestore, and Messaging
 * for the Local Sales Finder application.
 * 
 * Required environment variables:
 * - VITE_FIREBASE_API_KEY: Firebase API key
 * - VITE_FIREBASE_AUTH_DOMAIN: Firebase auth domain
 * - VITE_FIREBASE_PROJECT_ID: Firebase project ID
 * - VITE_FIREBASE_STORAGE_BUCKET: Firebase storage bucket
 * - VITE_FIREBASE_MESSAGING_SENDER_ID: Firebase messaging sender ID
 * - VITE_FIREBASE_APP_ID: Firebase app ID
 * - VITE_FIREBASE_MEASUREMENT_ID: Firebase measurement ID
 */

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, browserLocalPersistence, setPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging, isSupported } from 'firebase/messaging';

/**
 * Firebase configuration object containing all necessary credentials and settings.
 * All sensitive information is stored in environment variables for security.
 * @type {Object}
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

/**
 * Initialize the Firebase application with the configuration
 * @type {FirebaseApp}
 */
const app = initializeApp(firebaseConfig);

/**
 * Firebase Authentication instance
 * @type {Auth}
 */
export const auth = getAuth(app);

/**
 * Configure Firebase Authentication to use browser local persistence
 * This allows users to remain authenticated between page refreshes
 */
setPersistence(auth, browserLocalPersistence)
  .catch((error) => {
    console.error('Error setting auth persistence:', error);
  });

/**
 * Google Authentication provider instance
 * Used for implementing Google Sign-In
 * @type {GoogleAuthProvider}
 */
export const googleProvider = new GoogleAuthProvider();

/**
 * Firestore database instance
 * Used for all database operations in the application
 * @type {Firestore}
 */
export const db = getFirestore(app);

/**
 * Initialize Messaging if supported
 * @type {Function}
 */
export const initializeMessaging = async () => {
  try {
    const isMessagingSupported = await isSupported();
    if (isMessagingSupported) {
      console.log('Firebase Messaging is supported');
      const messaging = getMessaging(app);
      return messaging;
    } else {
      console.warn('Firebase Messaging is not supported');
      return null;
    }
  } catch (error) {
    console.error('Error initializing Firebase Messaging:', error);
    return null;
  }
};

export default app;

import { getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { getAuth } from 'firebase/auth';
import { initializeMessaging } from '../firebase';

class NotificationService {
  constructor() {
    this.messaging = null;
    this.auth = getAuth();
    this.initialize();
  }

  async initialize() {
    try {
      this.messaging = await initializeMessaging();
      if (this.messaging) {
        console.log('NotificationService: Messaging initialized successfully');
      }
    } catch (error) {
      console.error('NotificationService: Error initializing messaging:', error);
    }
  }

  async requestPermission() {
    try {
      if (!this.messaging) {
        console.warn('NotificationService: Messaging not initialized');
        return null;
      }

      console.log('NotificationService: Requesting permission...');
      const permission = await Notification.requestPermission();
      console.log('NotificationService: Permission result:', permission);
      
      if (permission === 'granted') {
        return this.setupMessaging();
      }
      throw new Error('Notification permission denied');
    } catch (error) {
      console.error('NotificationService: Error requesting permission:', error);
      throw error;
    }
  }

  async setupMessaging() {
    try {
      if (!this.messaging) {
        console.warn('NotificationService: Messaging not initialized');
        return null;
      }

      console.log('NotificationService: Setting up messaging...');
      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
      if (!vapidKey) {
        console.error('NotificationService: VAPID key not found in environment variables');
        return null;
      }

      const token = await getToken(this.messaging, { vapidKey });
      console.log('NotificationService: FCM token generated:', token ? 'Success' : 'Failed');
      
      if (token) {
        await this.saveTokenToDatabase(token);
        return token;
      }
      
      throw new Error('Failed to generate FCM token');
    } catch (error) {
      console.error('NotificationService: Error setting up messaging:', error);
      throw error;
    }
  }

  async saveTokenToDatabase(token) {
    try {
      const user = this.auth.currentUser;
      if (!user) {
        console.error('NotificationService: User must be logged in to save token');
        throw new Error('User must be logged in to save notification token');
      }

      console.log('NotificationService: Saving token to database...');
      const tokenRef = doc(db, 'users', user.uid, 'tokens', token);
      await setDoc(tokenRef, {
        token,
        createdAt: new Date().toISOString(),
        platform: 'web',
        searchRadius: await this.getUserSearchRadius(),
        location: await this.getUserLocation()
      });
      console.log('NotificationService: Token saved successfully');
    } catch (error) {
      console.error('NotificationService: Error saving token:', error);
      throw error;
    }
  }

  async getUserSearchRadius() {
    try {
      const user = this.auth.currentUser;
      if (!user) return null;

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const radius = userDoc.data()?.searchRadius || 10;
      console.log('NotificationService: User search radius:', radius);
      return radius;
    } catch (error) {
      console.error('NotificationService: Error getting search radius:', error);
      return 10; // Default to 10 miles
    }
  }

  async getUserLocation() {
    try {
      const user = this.auth.currentUser;
      if (!user) return null;

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const location = userDoc.data()?.location;
      console.log('NotificationService: User location:', location);
      return location;
    } catch (error) {
      console.error('NotificationService: Error getting user location:', error);
      return null;
    }
  }

  async removeToken(token) {
    try {
      const user = this.auth.currentUser;
      if (!user) return;

      console.log('NotificationService: Removing token...');
      const tokenRef = doc(db, 'users', user.uid, 'tokens', token);
      await deleteDoc(tokenRef);
      console.log('NotificationService: Token removed successfully');
    } catch (error) {
      console.error('NotificationService: Error removing token:', error);
    }
  }

  onMessageReceived(callback) {
    if (!this.messaging) {
      console.warn('NotificationService: Messaging not initialized');
      return () => {};
    }

    console.log('NotificationService: Setting up message listener');
    return onMessage(this.messaging, (payload) => {
      console.log('NotificationService: Message received:', payload);
      callback(payload);
    });
  }
}

export const notificationService = new NotificationService();

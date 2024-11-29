import React, { useState, useEffect } from 'react';
import { notificationService } from '../services/notificationService';
import { useAuth } from '../contexts/AuthContext';
import { BellAlertIcon, BellSlashIcon } from '@heroicons/react/24/outline';

function NotificationPreferences() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { currentUser } = useAuth();

  useEffect(() => {
    checkNotificationStatus();
  }, []);

  const checkNotificationStatus = async () => {
    try {
      const permission = Notification.permission;
      setNotificationsEnabled(permission === 'granted');
    } catch (error) {
      console.error('Error checking notification status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleNotifications = async () => {
    try {
      setIsLoading(true);
      if (!notificationsEnabled) {
        await notificationService.requestPermission();
        setNotificationsEnabled(true);
      } else {
        // If we want to disable notifications, we'll need to remove the token
        const token = await notificationService.messaging.getToken();
        if (token) {
          await notificationService.removeToken(token);
        }
        setNotificationsEnabled(false);
      }
    } catch (error) {
      console.error('Error toggling notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!currentUser) {
    return null;
  }

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Notification Preferences</h3>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Get notified about new sales events in your area
          </p>
        </div>
        <button
          onClick={handleToggleNotifications}
          disabled={isLoading}
          className={`flex items-center justify-center p-2 rounded-full transition-colors ${
            notificationsEnabled
              ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {isLoading ? (
            <div className="animate-spin h-5 w-5 border-2 border-blue-500 rounded-full border-t-transparent" />
          ) : notificationsEnabled ? (
            <BellAlertIcon className="h-5 w-5" />
          ) : (
            <BellSlashIcon className="h-5 w-5" />
          )}
        </button>
      </div>
    </div>
  );
}

export default NotificationPreferences;

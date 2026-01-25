/**
 * Notification Context
 * Manages the queue of error notifications displayed to users
 */

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import type { Notification, LogCategory } from "@core/types";
import { createNotification } from "@core/types/notification";
import { setNotificationListener } from "@services/logging";

// ============================================================================
// Configuration
// ============================================================================

const MAX_ACTIVE_NOTIFICATIONS = 5;
const MAX_HISTORY = 50;

// ============================================================================
// Context Types
// ============================================================================

interface NotificationContextValue {
  notifications: readonly Notification[];           // Active toasts
  notificationHistory: readonly Notification[];     // All notifications (session)
  addNotification: (message: string, category: LogCategory, details?: string) => void;
  dismissNotification: (id: string) => void;
  clearHistory: () => void;
}

// ============================================================================
// Context
// ============================================================================

const NotificationContext = createContext<NotificationContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<readonly Notification[]>([]);
  const [notificationHistory, setNotificationHistory] = useState<readonly Notification[]>([]);

  const addNotification = useCallback((message: string, category: LogCategory, details?: string) => {
    const notification = createNotification(message, category, details);

    // Add to active toasts
    setNotifications((prev) => {
      const updated = [notification, ...prev];
      return updated.slice(0, MAX_ACTIVE_NOTIFICATIONS);
    });

    // Add to history (keep all, up to max)
    setNotificationHistory((prev) => {
      const updated = [notification, ...prev];
      return updated.slice(0, MAX_HISTORY);
    });
  }, []);

  const dismissNotification = useCallback((id: string) => {
    // Only removes from active toasts, history remains
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearHistory = useCallback(() => {
    setNotificationHistory([]);
  }, []);

  // Register the notification listener with the logging service
  useEffect(() => {
    const unsubscribe = setNotificationListener((message, category, details) => {
      addNotification(message, category, details);
    });

    return unsubscribe;
  }, [addNotification]);

  return (
    <NotificationContext.Provider value={{ notifications, notificationHistory, addNotification, dismissNotification, clearHistory }}>
      {children}
    </NotificationContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}

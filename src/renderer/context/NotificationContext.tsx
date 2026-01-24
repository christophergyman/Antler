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

const MAX_NOTIFICATIONS = 5;

// ============================================================================
// Context Types
// ============================================================================

interface NotificationContextValue {
  notifications: readonly Notification[];
  addNotification: (message: string, category: LogCategory, details?: string) => void;
  dismissNotification: (id: string) => void;
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

  const addNotification = useCallback((message: string, category: LogCategory, details?: string) => {
    const notification = createNotification(message, category, details);
    setNotifications((prev) => {
      const updated = [notification, ...prev];
      // Keep only the most recent notifications
      return updated.slice(0, MAX_NOTIFICATIONS);
    });
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // Register the notification listener with the logging service
  useEffect(() => {
    const unsubscribe = setNotificationListener((message, category, details) => {
      addNotification(message, category, details);
    });

    return unsubscribe;
  }, [addNotification]);

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, dismissNotification }}>
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

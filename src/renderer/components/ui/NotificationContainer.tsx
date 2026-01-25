/**
 * Notification Container
 * Floating container that renders error notifications in the top-right corner
 */

import { useState, useCallback } from "react";
import { Alert, AlertTitle, AlertDescription } from "@core/components/ui/alert";
import { useNotifications } from "../../context/NotificationContext";
import { CATEGORY_DISPLAY_NAMES } from "@core/types/notification";
import { cn } from "@core/lib/utils";

// ============================================================================
// Alert Circle Icon (inline to avoid extra dependencies)
// ============================================================================

function AlertCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

// ============================================================================
// Notification Item
// ============================================================================

interface NotificationItemProps {
  id: string;
  category: string;
  message: string;
  details?: string;
  onDismiss: (id: string) => void;
}

function NotificationItem({ id, category, message, details, onDismiss }: NotificationItemProps) {
  const [isExiting, setIsExiting] = useState(false);

  const handleClick = useCallback(() => {
    setIsExiting(true);
    // Wait for fade-out animation before removing
    setTimeout(() => onDismiss(id), 150);
  }, [id, onDismiss]);

  const title = CATEGORY_DISPLAY_NAMES[category as keyof typeof CATEGORY_DISPLAY_NAMES] || "Error";

  return (
    <Alert
      variant="destructive"
      onClick={handleClick}
      className={cn(
        "cursor-pointer transition-all duration-150 shadow-lg",
        "bg-white/50",
        "animate-in fade-in slide-in-from-right-5",
        "hover:shadow-xl hover:scale-[1.02]",
        isExiting && "animate-out fade-out slide-out-to-right-5"
      )}
    >
      <AlertCircleIcon className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        {message}
        {details && (
          <span className="block mt-1 text-xs opacity-75">{details}</span>
        )}
      </AlertDescription>
    </Alert>
  );
}

// ============================================================================
// Notification Container
// ============================================================================

export function NotificationContainer() {
  const { notifications, dismissNotification } = useNotifications();

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]">
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          id={notification.id}
          category={notification.category}
          message={notification.message}
          details={notification.details}
          onDismiss={dismissNotification}
        />
      ))}
    </div>
  );
}

/**
 * Notification Popover
 * Bell button with popover showing notification history from the current session
 */

import { useState } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@core/components/ui/popover";
import { useNotifications } from "../../context/NotificationContext";
import { CATEGORY_DISPLAY_NAMES } from "@core/types/notification";
import { Bell } from "lucide-react";

// ============================================================================
// Time Formatting
// ============================================================================

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ============================================================================
// Notification History Item
// ============================================================================

interface NotificationHistoryItemProps {
  category: string;
  message: string;
  timestamp: string;
  details?: string;
}

function NotificationHistoryItem({ category, message, timestamp, details }: NotificationHistoryItemProps) {
  const [copied, setCopied] = useState(false);
  const title = CATEGORY_DISPLAY_NAMES[category as keyof typeof CATEGORY_DISPLAY_NAMES] || "Error";

  const handleClick = async () => {
    const content = [
      `[${title}] ${message}`,
      details,
      formatTime(timestamp)
    ].filter(Boolean).join('\n');

    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      onClick={handleClick}
      className="py-2 border-b border-gray-100 last:border-0 cursor-pointer hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-xs font-medium text-red-600">{title}</span>
        <span className="text-xs text-gray-400">
          {copied ? "Copied!" : formatTime(timestamp)}
        </span>
      </div>
      <p className="text-sm text-gray-700">{message}</p>
      {details && (
        <p className="text-xs text-gray-500 mt-1">{details}</p>
      )}
    </div>
  );
}

// ============================================================================
// Empty State
// ============================================================================

function EmptyState() {
  return (
    <div className="py-8 text-center text-gray-500">
      <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
      <p className="text-sm">No notifications yet</p>
    </div>
  );
}

// ============================================================================
// Notification Popover
// ============================================================================

export function NotificationPopover() {
  const { notificationHistory, clearHistory } = useNotifications();
  const count = notificationHistory.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="p-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors relative"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 px-1 flex items-center justify-center text-xs font-medium text-white bg-red-500 rounded-full">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 bg-white">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-medium text-gray-900">Notifications</h3>
          {count > 0 && (
            <button
              onClick={clearHistory}
              className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto px-4">
          {count === 0 ? (
            <EmptyState />
          ) : (
            notificationHistory.map((notification) => (
              <NotificationHistoryItem
                key={notification.id}
                category={notification.category}
                message={notification.message}
                timestamp={notification.timestamp}
                details={notification.details}
              />
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

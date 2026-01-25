/**
 * Error Boundary Component
 * Catches JavaScript errors in child component tree and displays fallback UI
 */

import { Component, type ReactNode, type ErrorInfo } from 'react';
import { logSystem } from '@services/logging';

// ============================================================================
// Types
// ============================================================================

interface ErrorBoundaryProps {
  /** Child components to render */
  children: ReactNode;
  /** Optional name for logging context (e.g., "KanbanBoard", "SettingsPanel") */
  name?: string;
  /** Custom fallback render function */
  fallback?: (error: Error, resetError: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// ============================================================================
// Error Boundary Component
// ============================================================================

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const boundaryName = this.props.name ?? 'Unknown';

    logSystem('error', `React error caught by ${boundaryName} boundary`, {
      errorMessage: error.message,
      errorStack: error.stack,
      componentStack: errorInfo.componentStack,
      boundaryName,
    });
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  override render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.resetError);
      }

      // Default fallback UI
      return <DefaultFallback error={this.state.error} onRetry={this.resetError} />;
    }

    return this.props.children;
  }
}

// ============================================================================
// Default Fallback UI
// ============================================================================

interface DefaultFallbackProps {
  error: Error;
  onRetry: () => void;
}

function DefaultFallback({ error, onRetry }: DefaultFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-8">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-lg w-full">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-red-100 rounded-full">
            <svg
              className="h-6 w-6 text-red-600"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-800">Something went wrong</h1>
        </div>

        <p className="text-gray-600 mb-4">
          An unexpected error occurred. The error has been logged and we apologize for the inconvenience.
        </p>

        <details className="mb-6">
          <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
            Technical Details
          </summary>
          <pre className="mt-2 p-3 bg-gray-100 rounded text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap">
            {error.message}
            {error.stack && `\n\n${error.stack}`}
          </pre>
        </details>

        <div className="flex gap-3">
          <button
            onClick={onRetry}
            className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            aria-label="Try again"
          >
            <svg
              className="h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Try Again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
            aria-label="Reload application"
          >
            Reload App
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Compact Fallback for Sub-boundaries
// ============================================================================

interface CompactFallbackProps {
  error: Error;
  onRetry: () => void;
  title?: string;
}

export function CompactFallback({ error, onRetry, title = 'Component Error' }: CompactFallbackProps) {
  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <svg
          className="h-4 w-4 text-red-600"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <span className="font-medium text-red-800">{title}</span>
      </div>
      <p className="text-sm text-red-700 mb-3">{error.message}</p>
      <button
        onClick={onRetry}
        className="px-3 py-1 text-sm text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
        aria-label="Retry"
      >
        Retry
      </button>
    </div>
  );
}

import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { KanbanBoard } from './components/KanbanBoard';
import { DotBackground } from './components/DotBackground';
import { useCards } from './hooks/useCards';
import { useDataSource } from './hooks/useDataSource';
import { useKanbanBoard } from './hooks/useKanbanBoard';
import { Toggle } from './components/ui/toggle';
import { getCachedConfig } from '@services/config';
import { initLogger, shutdownLogger, logSystem } from '@services/logging';
import { ensureDockerRuntime, onDockerRuntimeStatusChange } from '@services/dockerRuntime';

function ActionButton({
  onClick,
  children,
  isLoading = false,
  disabled = false
}: {
  onClick: () => void;
  children: ReactNode;
  isLoading?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
    >
      {isLoading ? (
        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        children
      )}
    </button>
  );
}

function SetupGuide({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md">
        <h1 className="text-xl font-semibold text-gray-800 mb-4">Setup Required</h1>
        <p className="text-gray-600 mb-4">
          Create <code className="bg-gray-200 px-1.5 py-0.5 rounded text-sm">antler.yaml</code> in the project root:
        </p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded mb-6 text-sm overflow-x-auto">
{`github:
  repository: owner/repo`}
        </pre>
        <p className="text-gray-500 text-sm mb-4">
          Replace <code className="bg-gray-200 px-1 rounded">owner/repo</code> with your GitHub repository (e.g., <code className="bg-gray-200 px-1 rounded">facebook/react</code>).
        </p>
        <ActionButton onClick={onRetry}>Retry</ActionButton>
      </div>
    </div>
  );
}

function Header({
  isMock,
  setDataSource,
  onRefresh,
  repository,
  isRefreshing
}: {
  isMock: boolean;
  setDataSource: (source: "mock" | "github") => void;
  onRefresh: () => void;
  repository: string | null;
  isRefreshing: boolean;
}) {
  return (
    <div className="px-6 pt-6 pb-2 shrink-0">
      {/* Match board width: 4 columns × 18rem + 3 gaps × 1rem = 75rem, but allow shrinking */}
      <div className="flex items-center justify-between w-full max-w-[calc(4*18rem+3*1rem)]">
        <div className="flex items-center gap-4">
          <Toggle
            pressed={isMock}
            onPressedChange={(pressed) => setDataSource(pressed ? "mock" : "github")}
            className={isMock ? "text-amber-600" : "text-green-600"}
          >
            {isMock ? "Mock Data" : "GitHub"}
          </Toggle>
          {repository && (
            <span className="text-gray-500 text-sm">{repository}</span>
          )}
        </div>
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="p-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Refresh"
        >
          <svg
            className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const { dataSource, setDataSource, isMock } = useDataSource();
  const { cards, setCards, isLoading, isRefreshing, error, errorCode, refresh } = useCards({ dataSource });
  const { handleCardStatusChange } = useKanbanBoard({ cards, onCardsChange: setCards });
  const [repository, setRepository] = useState<string | null>(null);

  useEffect(() => {
    if (!isMock) {
      getCachedConfig().then(result => {
        if (result.ok) {
          setRepository(result.value.github.repository);
        }
      });
    } else {
      setRepository(null);
    }
  }, [isMock]);

  useEffect(() => {
    initLogger();
    logSystem('info', 'App started');

    // Start Docker runtime in background (non-blocking)
    ensureDockerRuntime();

    const unsubscribe = onDockerRuntimeStatusChange((status) => {
      if (status === 'ready') {
        logSystem('info', 'Docker runtime became ready');
      }
    });

    return () => {
      unsubscribe();
      shutdownLogger();
    };
  }, []);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center flex-1">
          <div className="text-gray-600">Loading issues...</div>
        </div>
      );
    }

    if (errorCode === 'config_not_found') {
      return <SetupGuide onRetry={refresh} />;
    }

    if (error && cards.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center flex-1 gap-4">
          <div className="text-red-600">Error: {error}</div>
          <ActionButton onClick={refresh}>Retry</ActionButton>
        </div>
      );
    }

    return (
      <>
        {error && (
          <div className="mx-6 mb-4 p-3 bg-red-100 text-red-700 rounded-lg flex items-center justify-between shrink-0">
            <span>Refresh failed: {error}</span>
            <ActionButton onClick={refresh}>Retry</ActionButton>
          </div>
        )}
        <KanbanBoard cards={cards} onCardStatusChange={handleCardStatusChange} />
      </>
    );
  };

  return (
    <DotBackground>
      <div className="h-screen flex flex-col overflow-hidden">
        <Header isMock={isMock} setDataSource={setDataSource} onRefresh={refresh} repository={repository} isRefreshing={isRefreshing} />
        {renderContent()}
      </div>
    </DotBackground>
  );
}

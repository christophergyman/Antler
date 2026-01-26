import { useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { KanbanBoard } from './components/KanbanBoard';
import { DotBackground } from './components/DotBackground';
import { useCards } from './hooks/useCards';
import { useDataSource } from './hooks/useDataSource';
import { useKanbanBoard } from './hooks/useKanbanBoard';
import { useProjectSelector } from './hooks/useProjectSelector';
import { Toggle } from './components/ui/toggle';
import { SettingsPanel } from './components/SettingsPanel';
import { ProjectSelectorDialog } from './components/ProjectSelector';
import { NotificationProvider } from './context/NotificationContext';
import { NotificationContainer } from './components/ui/NotificationContainer';
import { NotificationPopover } from './components/ui/NotificationPopover';
import { getCachedConfig, clearConfigCache, loadConfig } from '@services/config';
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
  onSettingsOpen,
  repository,
  isRefreshing
}: {
  isMock: boolean;
  setDataSource: (source: "mock" | "github") => void;
  onRefresh: () => void;
  onSettingsOpen: () => void;
  repository: string | null;
  isRefreshing: boolean;
}) {
  return (
    <div className="px-6 pt-6 pb-2 shrink-0 flex justify-center">
      <div className="flex items-center justify-between w-full md:max-w-[calc(4*18rem+3*1rem)]">
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
        <div className="flex items-center gap-2">
          <button
            onClick={onSettingsOpen}
            className="p-2 text-white bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors"
            aria-label="Settings"
          >
            <svg
              className="h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <NotificationPopover />
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
    </div>
  );
}

export default function App() {
  const { dataSource, setDataSource, isMock } = useDataSource();
  const projectSelector = useProjectSelector();
  const { cards, setCards, isLoading, isRefreshing, error, errorCode, refresh } = useCards({ dataSource });
  const { handleCardStatusChange } = useKanbanBoard({ cards, onCardsChange: setCards });
  const [repository, setRepository] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showProjectSelector, setShowProjectSelector] = useState(false);
  const hasInitialized = useRef(false);

  // Initialize project selector and load repository config
  useEffect(() => {
    // Skip if still loading
    if (projectSelector.isLoading) return;

    // Handle initialization (runs once)
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      if (!projectSelector.hasProject) {
        setShowProjectSelector(true);
        return;
      }
    }

    // Handle mock mode - clear repository display
    if (isMock) {
      setRepository(null);
      return;
    }

    // Load repository from config when we have a project
    if (projectSelector.hasProject) {
      getCachedConfig().then(result => {
        if (result.ok) {
          setRepository(result.value.github.repository);
        } else {
          logSystem('warn', 'Failed to load repository from config', { code: result.error.code });
        }
      });
    }
  }, [isMock, projectSelector.isLoading, projectSelector.hasProject]);

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
    // Show loading while project selector is initializing
    if (projectSelector.isLoading || !hasInitialized.current) {
      return (
        <div className="flex items-center justify-center flex-1">
          <div className="text-gray-600">Loading...</div>
        </div>
      );
    }

    // If no project is selected, show message
    if (!projectSelector.hasProject) {
      return (
        <div className="flex items-center justify-center flex-1">
          <div className="text-gray-600">Select a project to get started</div>
        </div>
      );
    }

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

  const handleConfigChange = async () => {
    clearConfigCache();
    if (!isMock) {
      setCards([]);  // Clear old cards before loading new project
      // Reload from global config (project service auto-saves on project switch)
      const result = await loadConfig();
      if (result.ok) {
        setRepository(result.value.github.repository);
      } else {
        logSystem('warn', 'Failed to reload config', { code: result.error.code });
      }
      await refresh(true);
    }
  };

  const handleProjectSelected = async () => {
    clearConfigCache();
    setCards([]);  // Clear old cards before loading new project

    // Refresh project selector to get updated settings
    await projectSelector.refresh();

    // Load repository from global config (auto-saved by project service)
    if (!isMock) {
      const result = await loadConfig();
      if (result.ok) {
        setRepository(result.value.github.repository);
      } else {
        logSystem('warn', 'Failed to load config after project selection', { code: result.error.code });
      }
      await refresh(true);
    }

    setShowProjectSelector(false);
  };

  return (
    <NotificationProvider>
      <DotBackground>
        <div className="h-screen flex flex-col overflow-hidden">
          <Header
            isMock={isMock}
            setDataSource={setDataSource}
            onRefresh={refresh}
            onSettingsOpen={() => setIsSettingsOpen(true)}
            repository={repository}
            isRefreshing={isRefreshing}
          />
          {renderContent()}
        </div>
        <NotificationContainer />
      </DotBackground>
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onConfigChange={handleConfigChange}
      />
      <ProjectSelectorDialog
        isOpen={showProjectSelector}
        projectSelector={projectSelector}
        onProjectSelected={handleProjectSelected}
        onClose={() => setShowProjectSelector(false)}
        allowClose={projectSelector.hasProject}
      />
    </NotificationProvider>
  );
}

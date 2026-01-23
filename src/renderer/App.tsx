import { type ReactNode, useEffect } from 'react';
import { KanbanBoard } from './components/KanbanBoard';
import { DotBackground } from './components/DotBackground';
import { useCards } from './hooks/useCards';
import { useDataSource } from './hooks/useDataSource';
import { useKanbanBoard } from './hooks/useKanbanBoard';
import { Toggle } from './components/ui/toggle';
import { initLogger, shutdownLogger, logSystem } from '@services/logging';

function ActionButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
    >
      {children}
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
  onRefresh
}: {
  isMock: boolean;
  setDataSource: (source: "mock" | "github") => void;
  onRefresh: () => void;
}) {
  return (
    <div className="p-6 flex items-center justify-between shrink-0">
      <Toggle
        pressed={isMock}
        onPressedChange={(pressed) => setDataSource(pressed ? "mock" : "github")}
        className={isMock ? "text-amber-600" : "text-green-600"}
      >
        {isMock ? "Mock Data" : "GitHub"}
      </Toggle>
      <ActionButton onClick={onRefresh}>Refresh</ActionButton>
    </div>
  );
}

export default function App() {
  const { dataSource, setDataSource, isMock } = useDataSource();
  const { cards, setCards, isLoading, isRefreshing, error, errorCode, refresh } = useCards({ dataSource });
  const { handleCardStatusChange } = useKanbanBoard({ cards, onCardsChange: setCards });

  useEffect(() => {
    initLogger();
    logSystem('info', 'App started');
    return () => {
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
        {isRefreshing && (
          <div className="mx-6 mb-4 text-gray-500 text-sm shrink-0">Refreshing...</div>
        )}
        <KanbanBoard cards={cards} onCardStatusChange={handleCardStatusChange} />
      </>
    );
  };

  return (
    <DotBackground>
      <div className="h-screen flex flex-col overflow-hidden">
        <Header isMock={isMock} setDataSource={setDataSource} onRefresh={refresh} />
        {renderContent()}
      </div>
    </DotBackground>
  );
}

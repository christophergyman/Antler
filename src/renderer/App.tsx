import type { ReactNode } from 'react';
import { KanbanCard } from './components/KanbanCard';
import { useCards } from './hooks/useCards';
import { useDataSource } from './hooks/useDataSource';
import { mapCardStatusToStatusType } from './utils/statusMapping';
import { Toggle } from '@core/components/ui/toggle';

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
    <div className="p-6 flex items-center justify-between">
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
  const { cards, isLoading, isRefreshing, error, errorCode, refresh } = useCards({ dataSource });

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

    if (cards.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center flex-1 gap-4">
          <div className="text-gray-600">No issues found</div>
        </div>
      );
    }

    return (
      <div className="px-6 pb-6">
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg flex items-center justify-between">
            <span>Refresh failed: {error}</span>
            <ActionButton onClick={refresh}>Retry</ActionButton>
          </div>
        )}
        {isRefreshing && (
          <div className="mb-4 text-gray-500 text-sm">Refreshing...</div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {cards.map((card) => (
            <KanbanCard
              key={card.sessionUid}
              title={card.github.title}
              description={card.github.body}
              status={mapCardStatusToStatusType(card.status)}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Header isMock={isMock} setDataSource={setDataSource} onRefresh={refresh} />
      {renderContent()}
    </div>
  );
}

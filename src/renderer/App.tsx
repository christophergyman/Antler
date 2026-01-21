import type { ReactNode } from 'react';
import { KanbanCard } from './components/KanbanCard';
import { useCards } from './hooks/useCards';
import { mapCardStatusToStatusType } from './utils/statusMapping';

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

export default function App() {
  const { cards, isLoading, isRefreshing, error, refresh } = useCards();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-gray-600">Loading issues...</div>
      </div>
    );
  }

  if (error && cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-100 gap-4">
        <div className="text-red-600">Error: {error}</div>
        <ActionButton onClick={refresh}>Retry</ActionButton>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-100 gap-4">
        <div className="text-gray-600">No issues found</div>
        <ActionButton onClick={refresh}>Refresh</ActionButton>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
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
}

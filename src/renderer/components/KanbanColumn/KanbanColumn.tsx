import { memo, useMemo, useCallback } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Card } from '@core/types/card';
import { SortableCard } from './SortableCard';

interface KanbanColumnProps {
  id: string;
  label: string;
  color: string;
  bgColor: string;
  cards: Card[];
  isOver: boolean;
  onCardClick?: (card: Card) => void;
  onCreateIssue?: () => void;
}

export const KanbanColumn = memo(function KanbanColumn({
  id,
  label,
  color,
  bgColor,
  cards,
  isOver,
  onCardClick,
  onCreateIssue,
}: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({
    id,
  });

  // Memoize card IDs to prevent unnecessary re-renders of SortableContext
  const cardIds = useMemo(() => cards.map((card) => card.sessionUid), [cards]);

  const handleCreateClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onCreateIssue?.();
    },
    [onCreateIssue]
  );

  return (
    <div className="flex flex-col w-full md:w-72 md:min-w-72 h-auto md:h-full rounded-lg bg-gray-100/50">
      {/* Column Header */}
      <div
        className="flex items-center gap-2 p-3 rounded-t-lg"
        style={{ backgroundColor: bgColor }}
      >
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="font-medium text-gray-700">{label}</span>
        <div className="ml-auto flex items-center gap-1.5">
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ backgroundColor: color, color: 'white' }}
          >
            {cards.length}
          </span>
          {onCreateIssue && (
            <button
              onClick={handleCreateClick}
              className="p-1 rounded-md text-gray-500 hover:text-gray-700 hover:bg-white/50 transition-colors"
              aria-label="Create new issue"
              title="Create new issue"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Card List */}
      <div
        ref={setNodeRef}
        className={`flex-1 p-3 overflow-y-auto space-y-3 min-h-[200px] transition-colors rounded-b-lg ${
          isOver ? 'bg-blue-100/50 ring-2 ring-blue-300 ring-inset' : ''
        }`}
      >
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <SortableCard key={card.sessionUid} card={card} onClick={onCardClick} />
          ))}
        </SortableContext>
        {cards.length === 0 && !onCreateIssue && (
          <div className="h-full flex items-center justify-center text-gray-400 text-sm">
            Drop cards here
          </div>
        )}
        {/* Bottom + button for creating new issues */}
        {onCreateIssue && (
          <button
            onClick={handleCreateClick}
            className="w-full py-3 px-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            aria-label="Create new issue"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-sm font-medium">New Issue</span>
          </button>
        )}
      </div>
    </div>
  );
});

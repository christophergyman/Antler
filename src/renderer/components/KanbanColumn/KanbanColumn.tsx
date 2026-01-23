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
}

export function KanbanColumn({ id, label, color, bgColor, cards, isOver }: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({
    id,
  });

  const cardIds = cards.map((card) => card.sessionUid);

  return (
    <div className="flex flex-col w-72 min-w-72 h-full rounded-lg bg-gray-100/50">
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
        <span
          className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full"
          style={{ backgroundColor: color, color: 'white' }}
        >
          {cards.length}
        </span>
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
            <SortableCard key={card.sessionUid} card={card} />
          ))}
        </SortableContext>
        {cards.length === 0 && (
          <div className="h-full flex items-center justify-center text-gray-400 text-sm">
            Drop cards here
          </div>
        )}
      </div>
    </div>
  );
}

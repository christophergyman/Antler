import { useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type { Card, CardStatus } from '@core/types/card';
import { groupByStatus } from '@core/utils/collection';
import { KanbanColumn } from '../KanbanColumn';
import { KanbanCard } from '../KanbanCard';
import { KANBAN_COLUMNS } from '../../constants/status';

interface KanbanBoardProps {
  cards: Card[];
  onCardStatusChange: (cardId: string, newStatus: CardStatus) => void;
}

export function KanbanBoard({ cards, onCardStatusChange }: KanbanBoardProps) {
  const [activeCard, setActiveCard] = useState<Card | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const cardsByStatus = groupByStatus(cards);

  const findCard = useCallback(
    (id: string): Card | undefined => {
      return cards.find((card) => card.sessionUid === id);
    },
    [cards]
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const card = findCard(event.active.id as string);
      if (card) {
        setActiveCard(card);
      }
    },
    [findCard]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveCard(null);

      if (!over) return;

      const cardId = active.id as string;
      const overId = over.id as string;

      // Check if dropped on a column
      const isColumn = KANBAN_COLUMNS.some((col) => col.id === overId);
      if (isColumn) {
        const newStatus = overId as CardStatus;
        const card = findCard(cardId);
        if (card && card.status !== newStatus) {
          onCardStatusChange(cardId, newStatus);
        }
        return;
      }

      // Dropped on another card - find which column that card is in
      const targetCard = findCard(overId);
      if (targetCard) {
        const newStatus = targetCard.status;
        const card = findCard(cardId);
        if (card && card.status !== newStatus) {
          onCardStatusChange(cardId, newStatus);
        }
      }
    },
    [findCard, onCardStatusChange]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 px-6 min-h-0 flex-1">
        {KANBAN_COLUMNS.map((column) => (
          <KanbanColumn
            key={column.id}
            id={column.id}
            label={column.label}
            color={column.color}
            bgColor={column.bgColor}
            cards={cardsByStatus[column.id]}
          />
        ))}
      </div>
      <DragOverlay>
        {activeCard ? (
          <KanbanCard
            title={activeCard.github.title}
            description={activeCard.github.body}
            labels={activeCard.github.labels}
            hasError={activeCard.hasError}
            isDragging
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

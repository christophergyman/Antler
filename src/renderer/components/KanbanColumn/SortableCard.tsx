import { memo, useMemo, useRef, useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Card } from '@core/types/card';
import { KanbanCard } from '../KanbanCard';

interface SortableCardProps {
  card: Card;
  onClick?: (card: Card) => void;
}

export const SortableCard = memo(function SortableCard({ card, onClick }: SortableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.sessionUid });

  // Track if pointer moved significantly (indicating a drag, not a click)
  const didDragRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });

  const style = useMemo(
    () => ({
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    }),
    [transform, transition, isDragging]
  );

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    didDragRef.current = false;
    startPosRef.current = { x: e.clientX, y: e.clientY };
    listeners?.onPointerDown?.(e as unknown as PointerEvent);
  }, [listeners]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    // Check if moved more than 5px (before dnd-kit's 8px threshold)
    const dx = Math.abs(e.clientX - startPosRef.current.x);
    const dy = Math.abs(e.clientY - startPosRef.current.y);
    if (dx > 5 || dy > 5) {
      didDragRef.current = true;
    }
  }, []);

  const handleClick = useCallback(() => {
    if (!didDragRef.current && onClick) {
      onClick(card);
    }
  }, [card, onClick]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onClick={handleClick}
    >
      <KanbanCard
        title={card.github.title}
        description={card.github.body}
        labels={card.github.labels}
        hasError={card.hasError}
        isDragging={isDragging}
        worktreeOperation={card.worktreeOperation}
        worktreeError={card.worktreeError}
        worktreeCreated={card.worktreeCreated}
        port={card.port}
      />
    </div>
  );
});

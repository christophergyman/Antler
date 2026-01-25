import { memo, useMemo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Card } from '@core/types/card';
import { KanbanCard } from '../KanbanCard';

interface SortableCardProps {
  card: Card;
}

export const SortableCard = memo(function SortableCard({ card }: SortableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.sessionUid });

  const style = useMemo(
    () => ({
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    }),
    [transform, transition, isDragging]
  );

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <KanbanCard
        title={card.github.title}
        description={card.github.body}
        labels={card.github.labels}
        hasError={card.hasError}
        isDragging={isDragging}
        worktreeOperation={card.worktreeOperation}
        worktreeError={card.worktreeError}
        worktreeCreated={card.worktreeCreated}
        devcontainerRunning={card.devcontainerRunning}
        devcontainerPort={card.devcontainerPort}
      />
    </div>
  );
});

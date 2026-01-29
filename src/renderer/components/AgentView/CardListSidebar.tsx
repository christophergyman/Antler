import { memo, useMemo } from "react";
import type { Card } from "@core/types";
import { filterInProgress } from "@core/utils/collection";
import { AgentCardItem } from "./AgentCardItem";

interface CardListSidebarProps {
  cards: readonly Card[];
  selectedCardId: string | null;
  onCardSelect: (cardId: string) => void;
}

export const CardListSidebar = memo(function CardListSidebar({
  cards,
  selectedCardId,
  onCardSelect,
}: CardListSidebarProps) {
  // Filter to only show in_progress cards with worktrees
  const inProgressCards = useMemo(() => {
    return filterInProgress(cards).filter((card) => card.worktreeCreated);
  }, [cards]);

  if (inProgressCards.length === 0) {
    return (
      <div className="h-full flex flex-col rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold text-muted-foreground mb-4">
          Active Sessions
        </h2>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted-foreground text-center px-4">
            No active work sessions.
            <br />
            <span className="text-xs">
              Move a card to "In Progress" to start a session.
            </span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col rounded-lg border bg-card">
      <div className="p-4 border-b">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Active Sessions
          <span className="ml-2 text-xs font-normal">
            ({inProgressCards.length})
          </span>
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {inProgressCards.map((card) => (
          <AgentCardItem
            key={card.sessionUid}
            card={card}
            isSelected={selectedCardId === card.sessionUid}
            onSelect={() => onCardSelect(card.sessionUid)}
          />
        ))}
      </div>
    </div>
  );
});

import { memo, useState, useEffect } from "react";
import type { Card } from "@core/types";
import { TerminalContainer } from "./TerminalContainer";

interface TerminalPanelProps {
  selectedCard: Card | null;
}

export const TerminalPanel = memo(function TerminalPanel({
  selectedCard,
}: TerminalPanelProps) {
  // Track cards that have been viewed (to keep their terminals alive)
  const [viewedCards, setViewedCards] = useState<Map<string, Card>>(new Map());

  // Add selected card to viewed cards when it changes
  useEffect(() => {
    if (selectedCard && selectedCard.worktreePath) {
      setViewedCards((prev) => {
        const next = new Map(prev);
        next.set(selectedCard.sessionUid, selectedCard);
        return next;
      });
    }
  }, [selectedCard]);

  // Clean up terminals for cards that no longer exist or have no worktree
  useEffect(() => {
    if (selectedCard === null) return;

    setViewedCards((prev) => {
      const next = new Map(prev);
      for (const [cardId, card] of prev) {
        // Remove if card no longer has a worktree
        if (!card.worktreePath) {
          next.delete(cardId);
        }
      }
      return next;
    });
  }, [selectedCard]);

  if (!selectedCard) {
    return (
      <div className="h-full flex items-center justify-center rounded-lg border bg-card">
        <div className="text-center px-8">
          <div className="text-4xl mb-4 opacity-20">{">"}_</div>
          <p className="text-muted-foreground">
            Select a card to view its Claude agent
          </p>
        </div>
      </div>
    );
  }

  // Render all viewed terminals, but only show the selected one
  return (
    <div className="h-full relative">
      {Array.from(viewedCards.values()).map((card) => (
        <div
          key={card.sessionUid}
          className="absolute inset-0"
          style={{
            visibility:
              card.sessionUid === selectedCard.sessionUid ? "visible" : "hidden",
            zIndex: card.sessionUid === selectedCard.sessionUid ? 1 : 0,
          }}
        >
          <TerminalContainer
            card={card}
            isVisible={card.sessionUid === selectedCard.sessionUid}
          />
        </div>
      ))}
    </div>
  );
});

import { useCallback } from 'react';
import type { Card, CardStatus } from '@core/types/card';
import { setStatus, clearError } from '@core/card';
import { logCardStatusChange } from '@services/logging';

interface UseKanbanBoardOptions {
  cards: Card[];
  onCardsChange: React.Dispatch<React.SetStateAction<Card[]>>;
}

interface UseKanbanBoardReturn {
  handleCardStatusChange: (cardId: string, newStatus: CardStatus) => void;
}

export function useKanbanBoard({ cards, onCardsChange }: UseKanbanBoardOptions): UseKanbanBoardReturn {
  const handleCardStatusChange = useCallback(
    (cardId: string, newStatus: CardStatus) => {
      onCardsChange((prevCards) =>
        prevCards.map((card) => {
          if (card.sessionUid !== cardId) return card;

          const oldStatus = card.status;
          logCardStatusChange(cardId, oldStatus, newStatus);

          // Clear error when dragging out of Waiting
          if (card.hasError && newStatus !== 'waiting') {
            return setStatus(clearError(card), newStatus);
          }

          return setStatus(card, newStatus);
        })
      );
    },
    [onCardsChange]
  );

  return { handleCardStatusChange };
}

import { useCallback } from 'react';
import type { Card, CardStatus } from '@core/types/card';
import { setStatus } from '@core/card';

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
        prevCards.map((card) =>
          card.sessionUid === cardId ? setStatus(card, newStatus) : card
        )
      );
    },
    [onCardsChange]
  );

  return { handleCardStatusChange };
}

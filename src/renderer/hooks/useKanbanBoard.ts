import { useCallback, useRef } from 'react';
import type { Card, CardStatus } from '@core/types/card';
import {
  setStatus,
  clearError,
  startWorktreeCreation,
  completeWorktreeCreation,
  startWorktreeRemoval,
  completeWorktreeRemoval,
  setWorktreeErrorState,
} from '@core/card';
import { logCardStatusChange, logUserAction } from '@services/logging';
import { getCurrentRepoRoot } from '@services/config';
import { startWorkSession, stopWorkSession } from '@services/workSession';

interface UseKanbanBoardOptions {
  cards: Card[];
  onCardsChange: React.Dispatch<React.SetStateAction<Card[]>>;
}

interface UseKanbanBoardReturn {
  handleCardStatusChange: (cardId: string, newStatus: CardStatus) => void;
}

export function useKanbanBoard({ cards, onCardsChange }: UseKanbanBoardOptions): UseKanbanBoardReturn {
  // Track AbortControllers per card for cancellation support
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

  // Helper to update a single card in the cards array
  const updateCard = useCallback(
    (cardId: string, updater: (card: Card) => Card) => {
      onCardsChange((prevCards) =>
        prevCards.map((card) => (card.sessionUid === cardId ? updater(card) : card))
      );
    },
    [onCardsChange]
  );

  // Start a work session for a card (async)
  const handleStartWorkSession = useCallback(
    async (card: Card) => {
      logUserAction('worktree_start', 'Starting worktree creation', { cardId: card.sessionUid });

      // Cancel any existing operation for this card
      const existingController = abortControllersRef.current.get(card.sessionUid);
      if (existingController) {
        existingController.abort();
      }

      // Create new abort controller
      const abortController = new AbortController();
      abortControllersRef.current.set(card.sessionUid, abortController);

      // Update card to show creating state
      updateCard(card.sessionUid, (c) => startWorktreeCreation(c));

      try {
        // Get repo root
        const repoRootResult = await getCurrentRepoRoot();
        if (!repoRootResult.ok) {
          updateCard(card.sessionUid, (c) =>
            setWorktreeErrorState(setStatus(c, 'idle'), repoRootResult.error.message)
          );
          return;
        }

        const repoRoot = repoRootResult.value;

        // Start work session
        const result = await startWorkSession(repoRoot, card, abortController.signal);

        // Check if operation was cancelled
        if (abortController.signal.aborted) {
          return;
        }

        if (result.ok) {
          // Success - update card with worktree info
          updateCard(card.sessionUid, (c) =>
            completeWorktreeCreation(c, result.value.worktreePath, result.value.port)
          );
        } else {
          // Failure - set error and revert to idle
          updateCard(card.sessionUid, (c) =>
            setWorktreeErrorState(setStatus(c, 'idle'), result.error.message)
          );
        }
      } catch (error) {
        // Unexpected error
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (!abortController.signal.aborted) {
          updateCard(card.sessionUid, (c) =>
            setWorktreeErrorState(setStatus(c, 'idle'), message)
          );
        }
      } finally {
        // Clean up abort controller
        abortControllersRef.current.delete(card.sessionUid);
      }
    },
    [updateCard]
  );

  // Stop a work session for a card (async)
  const handleStopWorkSession = useCallback(
    async (card: Card) => {
      logUserAction('worktree_stop', 'Stopping worktree', { cardId: card.sessionUid });

      // Cancel any pending start operation
      const existingController = abortControllersRef.current.get(card.sessionUid);
      if (existingController) {
        existingController.abort();
        abortControllersRef.current.delete(card.sessionUid);

        // If we cancelled a pending operation, just revert to idle without cleanup
        // The cancelled operation will handle its own cleanup
        if (card.worktreeOperation === 'creating') {
          logUserAction('worktree_cancel', 'Cancelled pending worktree creation', {
            cardId: card.sessionUid,
          });
          updateCard(card.sessionUid, (c) => completeWorktreeRemoval(c));
          return;
        }
      }

      // If there's no worktree, nothing to do
      if (!card.worktreeCreated && !card.worktreePath) {
        return;
      }

      // Update card to show removing state
      updateCard(card.sessionUid, (c) => startWorktreeRemoval(c));

      try {
        // Get repo root
        const repoRootResult = await getCurrentRepoRoot();
        if (!repoRootResult.ok) {
          updateCard(card.sessionUid, (c) =>
            setWorktreeErrorState(c, repoRootResult.error.message)
          );
          return;
        }

        const repoRoot = repoRootResult.value;

        // Stop work session
        const result = await stopWorkSession(repoRoot, card);

        if (result.ok) {
          // Success - clear worktree info
          updateCard(card.sessionUid, (c) => completeWorktreeRemoval(c));
        } else {
          // Failure - set error
          updateCard(card.sessionUid, (c) => setWorktreeErrorState(c, result.error.message));
        }
      } catch (error) {
        // Unexpected error
        const message = error instanceof Error ? error.message : 'Unknown error';
        updateCard(card.sessionUid, (c) => setWorktreeErrorState(c, message));
      }
    },
    [updateCard]
  );

  const handleCardStatusChange = useCallback(
    (cardId: string, newStatus: CardStatus) => {
      const card = cards.find((c) => c.sessionUid === cardId);
      if (!card) return;

      const oldStatus = card.status;
      logCardStatusChange(cardId, oldStatus, newStatus);

      // Check if this is a transition that triggers work session operations
      const isIdleToInProgress = oldStatus === 'idle' && newStatus === 'in_progress';
      const isInProgressToIdle = oldStatus === 'in_progress' && newStatus === 'idle';

      // Update status immediately (optimistic update)
      onCardsChange((prevCards) =>
        prevCards.map((c) => {
          if (c.sessionUid !== cardId) return c;

          // Clear error when dragging out of Waiting
          if (c.hasError && newStatus !== 'waiting') {
            return setStatus(clearError(c), newStatus);
          }

          return setStatus(c, newStatus);
        })
      );

      // Trigger async work session operations
      if (isIdleToInProgress) {
        // Start work session (async)
        handleStartWorkSession(card);
      } else if (isInProgressToIdle) {
        // Stop work session (async)
        handleStopWorkSession(card);
      }
    },
    [cards, onCardsChange, handleStartWorkSession, handleStopWorkSession]
  );

  return { handleCardStatusChange };
}

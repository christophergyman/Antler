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
import { logCardStatusChange, logUserAction, logWorktree, logConfig } from '@services/logging';
import { getCurrentRepoRoot } from '@services/config';
import { startWorkSession, stopWorkSession } from '@services/workSession';
import { saveCardStatus, removeCardStatus } from '@services/cardStatus';

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

      // Update card to show creating state and set status to in_progress
      updateCard(card.sessionUid, (c) => setStatus(startWorktreeCreation(c), 'in_progress'));

      try {
        // Get repo root
        const repoRootResult = await getCurrentRepoRoot();
        if (!repoRootResult.ok) {
          logConfig('error', 'Failed to get repo root for work session', {
            code: repoRootResult.error.code,
            message: repoRootResult.error.message,
            cardId: card.sessionUid,
            cardName: card.name,
          });
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
          logUserAction('worktree_cancel', 'Work session start aborted', {
            cardId: card.sessionUid,
            cardName: card.name,
          });
          return;
        }

        if (result.ok) {
          // Success - update card with worktree info
          logWorktree('info', 'Work session started successfully', {
            cardId: card.sessionUid,
            cardName: card.name,
            worktreePath: result.value.worktreePath,
            port: result.value.port,
          });
          updateCard(card.sessionUid, (c) =>
            completeWorktreeCreation(c, result.value.worktreePath, result.value.port)
          );

          // Persist status for session restoration
          if (card.github.issueNumber !== null) {
            saveCardStatus(card.github.issueNumber, 'in_progress');
          }
        } else {
          // Failure - set error and revert to idle
          logWorktree('error', 'Work session start failed', {
            code: result.error.code,
            message: result.error.message,
            details: result.error.details,
            cardId: card.sessionUid,
            cardName: card.name,
          });
          updateCard(card.sessionUid, (c) =>
            setWorktreeErrorState(setStatus(c, 'idle'), result.error.message)
          );
        }
      } catch (error) {
        // Unexpected error
        const message = error instanceof Error ? error.message : 'Unknown error';
        const stack = error instanceof Error ? error.stack : undefined;
        if (!abortController.signal.aborted) {
          logWorktree('error', 'Unexpected error during work session start', {
            message,
            stack,
            cardId: card.sessionUid,
            cardName: card.name,
          });
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
          updateCard(card.sessionUid, (c) => setStatus(completeWorktreeRemoval(c), 'idle'));
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
          logConfig('error', 'Failed to get repo root for stopping work session', {
            code: repoRootResult.error.code,
            message: repoRootResult.error.message,
            cardId: card.sessionUid,
            cardName: card.name,
          });
          updateCard(card.sessionUid, (c) =>
            setWorktreeErrorState(c, repoRootResult.error.message)
          );
          return;
        }

        const repoRoot = repoRootResult.value;

        // Stop work session
        const result = await stopWorkSession(repoRoot, card);

        if (result.ok) {
          // Success - clear worktree info and set status to idle
          logWorktree('info', 'Work session stopped successfully', {
            cardId: card.sessionUid,
            cardName: card.name,
          });
          updateCard(card.sessionUid, (c) => setStatus(completeWorktreeRemoval(c), 'idle'));

          // Remove persisted status since worktree is gone
          if (card.github.issueNumber !== null) {
            removeCardStatus(card.github.issueNumber);
          }
        } else {
          // Failure - set error
          logWorktree('error', 'Work session stop failed', {
            code: result.error.code,
            message: result.error.message,
            details: result.error.details,
            cardId: card.sessionUid,
            cardName: card.name,
            worktreePath: card.worktreePath,
          });
          updateCard(card.sessionUid, (c) => setWorktreeErrorState(c, result.error.message));
        }
      } catch (error) {
        // Unexpected error
        const message = error instanceof Error ? error.message : 'Unknown error';
        const stack = error instanceof Error ? error.stack : undefined;
        logWorktree('error', 'Unexpected error during work session stop', {
          message,
          stack,
          cardId: card.sessionUid,
          cardName: card.name,
        });
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

      // For work session operations, don't update status immediately
      // The async handlers will update the status after completion
      if (isIdleToInProgress) {
        // Start work session (async) - status change handled in callback
        handleStartWorkSession(card);
      } else if (isInProgressToIdle) {
        // Stop work session (async) - status change handled in callback
        handleStopWorkSession(card);
      } else {
        // For other status changes (e.g., moving between waiting/done), update immediately
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

        // Persist status for cards with worktrees (for session restoration)
        if (card.worktreeCreated && card.github.issueNumber !== null) {
          saveCardStatus(card.github.issueNumber, newStatus);
        }
      }
    },
    [cards, onCardsChange, handleStartWorkSession, handleStopWorkSession]
  );

  return { handleCardStatusChange };
}

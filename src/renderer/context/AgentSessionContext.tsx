/**
 * Agent Session Context
 * Manages Claude CLI agent sessions across the application
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import type { AgentSession, AgentStatus } from "@core/types";
import { createAgentSession, updateAgentSession } from "@core/types";
import { logWorktree } from "@services/logging";

// ============================================================================
// Configuration
// ============================================================================

const MAX_SESSIONS = 5;

// ============================================================================
// Context Types
// ============================================================================

interface AgentSessionContextValue {
  sessions: ReadonlyMap<string, AgentSession>;
  getSession: (cardId: string) => AgentSession | undefined;
  startSession: (
    cardId: string,
    worktreePath: string,
    port: number | null
  ) => AgentSession;
  updateSessionStatus: (cardId: string, status: AgentStatus, error?: string) => void;
  stopSession: (cardId: string) => void;
  getSessionCount: () => number;
  canStartSession: () => boolean;
}

// ============================================================================
// Context
// ============================================================================

const AgentSessionContext = createContext<AgentSessionContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

export function AgentSessionProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<ReadonlyMap<string, AgentSession>>(
    new Map()
  );

  const getSession = useCallback(
    (cardId: string) => {
      return sessions.get(cardId);
    },
    [sessions]
  );

  const startSession = useCallback(
    (cardId: string, worktreePath: string, port: number | null) => {
      // Check if session already exists
      const existing = sessions.get(cardId);
      if (existing) {
        logWorktree("warn", "Session already exists for card", { cardId });
        return existing;
      }

      // Check session limit
      if (sessions.size >= MAX_SESSIONS) {
        logWorktree("warn", "Max sessions reached", {
          current: sessions.size,
          max: MAX_SESSIONS,
        });
        throw new Error(
          `Maximum of ${MAX_SESSIONS} concurrent sessions allowed`
        );
      }

      const session = createAgentSession(cardId, worktreePath, port);

      setSessions((prev) => {
        const next = new Map(prev);
        next.set(cardId, session);
        return next;
      });

      logWorktree("info", "Agent session started", {
        cardId,
        sessionId: session.id,
        worktreePath,
        port,
      });

      return session;
    },
    [sessions]
  );

  const updateSessionStatus = useCallback(
    (cardId: string, status: AgentStatus, error?: string) => {
      setSessions((prev) => {
        const session = prev.get(cardId);
        if (!session) {
          logWorktree("warn", "Cannot update status: session not found", {
            cardId,
          });
          return prev;
        }

        const updated = updateAgentSession(session, {
          status,
          error: error ?? null,
        });

        const next = new Map(prev);
        next.set(cardId, updated);
        return next;
      });

      logWorktree("debug", "Session status updated", { cardId, status, error });
    },
    []
  );

  const stopSession = useCallback((cardId: string) => {
    setSessions((prev) => {
      const session = prev.get(cardId);
      if (!session) {
        return prev;
      }

      logWorktree("info", "Agent session stopped", {
        cardId,
        sessionId: session.id,
      });

      const next = new Map(prev);
      next.delete(cardId);
      return next;
    });
  }, []);

  const getSessionCount = useCallback(() => {
    return sessions.size;
  }, [sessions]);

  const canStartSession = useCallback(() => {
    return sessions.size < MAX_SESSIONS;
  }, [sessions]);

  const contextValue = useMemo(
    () => ({
      sessions,
      getSession,
      startSession,
      updateSessionStatus,
      stopSession,
      getSessionCount,
      canStartSession,
    }),
    [
      sessions,
      getSession,
      startSession,
      updateSessionStatus,
      stopSession,
      getSessionCount,
      canStartSession,
    ]
  );

  return (
    <AgentSessionContext.Provider value={contextValue}>
      {children}
    </AgentSessionContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useAgentSessions(): AgentSessionContextValue {
  const context = useContext(AgentSessionContext);
  if (!context) {
    throw new Error(
      "useAgentSessions must be used within an AgentSessionProvider"
    );
  }
  return context;
}

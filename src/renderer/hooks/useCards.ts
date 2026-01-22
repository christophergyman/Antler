import { useState, useEffect, useCallback, useRef } from 'react';
import type { Card } from '@core/types/card';
import type { ConfigError, GitHubError } from '@core/types/result';
import { getCachedConfig } from '@services/config';
import { fetchIssuesWithPRs } from '@services/github';
import { syncCards } from '@services/cardSync';

interface UseCardsReturn {
  cards: Card[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

type FetchError = ConfigError | GitHubError;

function formatError(error: FetchError): string {
  if (error.details) {
    return `${error.message}: ${error.details}`;
  }
  return error.message;
}

export function useCards(): UseCardsReturn {
  const [cards, setCards] = useState<Card[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasFetched = useRef(false);

  const fetchCards = useCallback(async () => {
    const isInitial = !hasFetched.current;

    if (isInitial) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setError(null);

    try {
      // Load config
      const configResult = await getCachedConfig();
      if (!configResult.ok) {
        setError(formatError(configResult.error));
        return;
      }

      // Fetch GitHub issues with PRs
      const issuesResult = await fetchIssuesWithPRs(configResult.value.github.repository);
      if (!issuesResult.ok) {
        setError(formatError(issuesResult.error));
        return;
      }

      // Sync cards with fetched issues
      const syncResult = syncCards(cards, issuesResult.value);
      setCards(syncResult.cards);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      hasFetched.current = true;
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [cards]);

  useEffect(() => {
    fetchCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { cards, isLoading, isRefreshing, error, refresh: fetchCards };
}

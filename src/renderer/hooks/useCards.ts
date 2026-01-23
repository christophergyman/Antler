import { useState, useEffect, useCallback, useRef } from 'react';
import type { Card } from '@core/types/card';
import type { ConfigError, GitHubError } from '@core/types/result';
import { getCachedConfig } from '@services/config';
import { fetchIssuesWithPRs } from '@services/github';
import { syncCards } from '@services/cardSync';
import type { DataSource } from './useDataSource';
import { mockCards } from '../data/mockCards';

interface UseCardsOptions {
  dataSource: DataSource;
}

interface UseCardsReturn {
  cards: Card[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  errorCode: string | null;
  refresh: () => Promise<void>;
}

type FetchError = ConfigError | GitHubError;

function formatError(error: FetchError): string {
  if (error.details) {
    return `${error.message}: ${error.details}`;
  }
  return error.message;
}

export function useCards({ dataSource }: UseCardsOptions): UseCardsReturn {
  const [cards, setCards] = useState<Card[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
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
    setErrorCode(null);

    // Return mock data immediately if mock mode
    if (dataSource === 'mock') {
      setCards(mockCards);
      hasFetched.current = true;
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      // Load config
      const configResult = await getCachedConfig();
      if (!configResult.ok) {
        setError(formatError(configResult.error));
        setErrorCode(configResult.error.code);
        return;
      }

      // Fetch GitHub issues with PRs
      const issuesResult = await fetchIssuesWithPRs(configResult.value.github.repository);
      if (!issuesResult.ok) {
        setError(formatError(issuesResult.error));
        setErrorCode(issuesResult.error.code);
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
  }, [cards, dataSource]);

  useEffect(() => {
    fetchCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSource]);

  return { cards, isLoading, isRefreshing, error, errorCode, refresh: fetchCards };
}

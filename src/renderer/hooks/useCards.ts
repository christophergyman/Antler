import { useState, useEffect, useCallback, useRef, type RefObject } from 'react';
import type { Card } from '@core/types/card';
import type { ConfigError, GitHubError } from '@core/types/result';
import { getCachedConfig } from '@services/config';
import { fetchIssuesWithPRs } from '@services/github';
import { syncCards } from '@services/cardSync';
import { logDataSync, logPerformance, logDataRefresh } from '@services/logging';
import type { DataSource } from './useDataSource';
import { mockCards } from '../data/mockCards';

interface UseCardsOptions {
  dataSource: DataSource;
}

interface UseCardsReturn {
  cards: Card[];
  setCards: React.Dispatch<React.SetStateAction<Card[]>>;
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

  // Use a ref to access current cards without creating a dependency
  // This prevents the infinite loop where fetchCards -> cards change -> fetchCards recreated
  const cardsRef = useRef<Card[]>(cards);
  cardsRef.current = cards;

  const fetchCards = useCallback(async () => {
    const isInitial = !hasFetched.current;
    const startTime = Date.now();

    logDataSync('info', `Starting ${isInitial ? 'initial' : 'refresh'} fetch`, { dataSource });

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
      logDataRefresh('mock', mockCards.length);
      logPerformance('Mock data loaded', Date.now() - startTime);
      return;
    }

    try {
      // Load config
      const configResult = await getCachedConfig();
      if (!configResult.ok) {
        logDataSync('error', 'Config load failed', { code: configResult.error.code });
        setError(formatError(configResult.error));
        setErrorCode(configResult.error.code);
        return;
      }

      // Fetch GitHub issues with PRs
      logDataSync('debug', 'Fetching GitHub issues', { repo: configResult.value.github.repository });
      const issuesResult = await fetchIssuesWithPRs(configResult.value.github.repository);
      if (!issuesResult.ok) {
        logDataSync('error', 'GitHub fetch failed', { code: issuesResult.error.code });
        setError(formatError(issuesResult.error));
        setErrorCode(issuesResult.error.code);
        return;
      }

      // Sync cards with fetched issues
      // Use ref to get current cards without dependency
      const syncResult = syncCards(cardsRef.current, issuesResult.value);
      setCards(syncResult.cards);

      logDataSync('info', 'Sync completed', {
        created: syncResult.stats.created,
        updated: syncResult.stats.updated,
        preserved: syncResult.stats.preserved,
      });
      logDataRefresh('github', syncResult.cards.length);
      logPerformance('GitHub data fetch', Date.now() - startTime);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      logDataSync('error', 'Unexpected fetch error', { error: errorMessage });
      setError(errorMessage);
    } finally {
      hasFetched.current = true;
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [dataSource]); // Removed cards dependency - using ref instead

  useEffect(() => {
    fetchCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSource]);

  return { cards, setCards, isLoading, isRefreshing, error, errorCode, refresh: fetchCards };
}

import type { Card } from '../../main/types/card';
import type { Result, ConfigError, GitHubError } from '../../main/types/result';
import type { SyncResult } from '../../main/services/cardSync';

export type FetchIssuesResult = Result<SyncResult, ConfigError | GitHubError>;

export interface ElectronAPI {
  platform: string;
  fetchGitHubIssues: () => Promise<FetchIssuesResult>;
  getCards: () => Promise<Card[]>;
  reloadConfig: () => Promise<Result<unknown, ConfigError>>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}

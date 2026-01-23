import { createCard } from '@core/card';
import type { Card } from '@core/types/card';

export const mockCards: Card[] = [
  // === ACTIVE (3 cards) ===
  createCard({
    status: 'active',
    github: {
      issueNumber: 1,
      title: 'Add user authentication',
      body: 'Implement OAuth2 flow with GitHub provider',
      labels: ['feature', 'priority:high'],
      state: 'open',
    },
  }),
  createCard({
    status: 'active',
    github: {
      issueNumber: 5,
      title: 'Implement dark mode toggle',
      body: 'Add theme switcher in settings panel with system preference detection',
      labels: ['feature', 'ui'],
      state: 'open',
    },
  }),
  createCard({
    status: 'active',
    github: {
      issueNumber: 9,
      title: 'Add keyboard shortcuts',
      body: 'Implement Cmd+K command palette and common navigation shortcuts',
      labels: ['feature', 'ux'],
      state: 'open',
    },
  }),

  // === IDLE (3 cards) ===
  createCard({
    status: 'idle',
    github: {
      issueNumber: 2,
      title: 'Fix navigation bug',
      body: 'Back button not working on mobile',
      labels: ['bug', 'mobile'],
      state: 'open',
    },
  }),
  createCard({
    status: 'idle',
    github: {
      issueNumber: 6,
      title: 'Add export to CSV',
      body: 'Allow users to export their data in CSV format for backup',
      labels: ['feature'],
      state: 'open',
    },
  }),
  createCard({
    status: 'idle',
    github: {
      issueNumber: 10,
      title: 'Improve error messages',
      body: 'Make error messages more user-friendly with actionable suggestions',
      labels: ['ux', 'priority:low'],
      state: 'open',
    },
  }),

  // === PAUSED (2 cards) ===
  createCard({
    status: 'paused',
    github: {
      issueNumber: 4,
      title: 'Migrate to PostgreSQL',
      body: 'Replace SQLite with PostgreSQL for better concurrent write performance',
      labels: ['chore', 'database'],
      state: 'open',
    },
  }),
  createCard({
    status: 'paused',
    github: {
      issueNumber: 8,
      title: 'Add real-time collaboration',
      body: 'Implement WebSocket-based real-time sync between users',
      labels: ['feature', 'priority:high'],
      state: 'open',
    },
  }),

  // === COMPLETED (3 cards) ===
  createCard({
    status: 'completed',
    github: {
      issueNumber: 3,
      title: 'Update dependencies',
      body: 'Bump React to v19',
      labels: ['chore'],
      state: 'closed',
    },
  }),
  createCard({
    status: 'completed',
    github: {
      issueNumber: 7,
      title: 'Fix memory leak in dashboard',
      body: 'Component not cleaning up event listeners on unmount',
      labels: ['bug', 'performance'],
      state: 'closed',
    },
  }),
  createCard({
    status: 'completed',
    github: {
      issueNumber: 11,
      title: 'Add API documentation',
      body: 'Document all REST endpoints with OpenAPI spec',
      labels: ['docs'],
      state: 'closed',
    },
  }),

  // === ERROR (1 card) ===
  createCard({
    status: 'error',
    github: {
      issueNumber: 12,
      title: 'CI pipeline broken',
      body: 'Tests failing due to flaky integration test in auth module',
      labels: ['bug', 'ci', 'priority:high'],
      state: 'open',
    },
  }),
];

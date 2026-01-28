import { memo } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { ERROR_BADGE_COLOR } from '../../constants/status';
import type { KanbanCardProps } from './types';

// Colors for worktree badges
const WORKTREE_BADGE_COLOR = '#8b5cf6'; // Purple
const PORT_BADGE_COLOR = '#06b6d4'; // Cyan
const CREATING_BADGE_COLOR = '#f59e0b'; // Amber
const REMOVING_BADGE_COLOR = '#f59e0b'; // Amber

// Simple spinner component
function Spinner() {
  return (
    <svg
      className="animate-spin h-3 w-3 inline-block mr-1"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

export const KanbanCard = memo(function KanbanCard({
  title,
  description,
  labels,
  hasError,
  isDragging,
  worktreeOperation,
  worktreeError,
  worktreeCreated,
  port,
}: KanbanCardProps) {
  const isCreating = worktreeOperation === 'creating';
  const isRemoving = worktreeOperation === 'removing';
  const hasWorktreeError = worktreeOperation === 'error' && worktreeError;

  // Show badges in order: errors first, then operation status, then active states, then labels
  const showBadges =
    hasError ||
    hasWorktreeError ||
    isCreating ||
    isRemoving ||
    worktreeCreated ||
    (labels && labels.length > 0);

  return (
    <Card className={`w-full hover:shadow-lg transition-shadow cursor-grab ${isDragging ? 'shadow-xl rotate-2' : ''}`}>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <CardDescription className="line-clamp-2">{description}</CardDescription>
        {showBadges && (
          <div className="mt-3 flex gap-1.5 flex-wrap">
            {/* Error badges */}
            {hasError && (
              <Badge
                className="text-xs text-white"
                style={{ backgroundColor: ERROR_BADGE_COLOR }}
              >
                Error
              </Badge>
            )}
            {hasWorktreeError && (
              <Badge
                className="text-xs text-white"
                style={{ backgroundColor: ERROR_BADGE_COLOR }}
                title={worktreeError}
              >
                Worktree Error
              </Badge>
            )}

            {/* Operation in progress badges */}
            {isCreating && (
              <Badge
                className="text-xs text-white"
                style={{ backgroundColor: CREATING_BADGE_COLOR }}
              >
                <Spinner />
                Creating...
              </Badge>
            )}
            {isRemoving && (
              <Badge
                className="text-xs text-white"
                style={{ backgroundColor: REMOVING_BADGE_COLOR }}
              >
                <Spinner />
                Removing...
              </Badge>
            )}

            {/* Active state badges */}
            {worktreeCreated && !isCreating && !isRemoving && (
              <Badge
                className="text-xs text-white"
                style={{ backgroundColor: WORKTREE_BADGE_COLOR }}
              >
                Worktree
              </Badge>
            )}
            {port !== null && port !== undefined && worktreeCreated && !isCreating && !isRemoving && (
              <Badge
                className="text-xs text-white"
                style={{ backgroundColor: PORT_BADGE_COLOR }}
                title={`Port ${port}`}
              >
                :{port}
              </Badge>
            )}

            {/* Labels */}
            {labels?.map((label) => (
              <Badge key={label} variant="secondary" className="text-xs whitespace-nowrap">
                {label}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
});

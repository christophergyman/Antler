import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { ERROR_BADGE_COLOR } from '../../constants/status';
import type { KanbanCardProps } from './types';

export function KanbanCard({ title, description, labels, hasError, isDragging }: KanbanCardProps) {
  return (
    <Card className={`w-full hover:shadow-lg transition-shadow cursor-grab ${isDragging ? 'shadow-xl rotate-2' : ''}`}>
      <CardHeader className="p-4 pb-2">
        {hasError && (
          <div className="flex justify-end mb-2">
            <Badge
              className="text-xs text-white"
              style={{ backgroundColor: ERROR_BADGE_COLOR }}
            >
              Error
            </Badge>
          </div>
        )}
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <CardDescription className="line-clamp-2">{description}</CardDescription>
        {labels && labels.length > 0 && (
          <div className="mt-3 flex gap-1.5 flex-wrap">
            {labels.map((label) => (
              <Badge key={label} variant="secondary" className="text-xs whitespace-nowrap">
                {label}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

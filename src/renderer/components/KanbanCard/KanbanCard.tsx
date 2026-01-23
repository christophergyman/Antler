import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { statusColors, statusLabels } from '../../constants/status';
import type { KanbanCardProps } from './types';

export function KanbanCard({ title, description, status, labels }: KanbanCardProps) {
  return (
    <Card className="w-64 hover:shadow-lg transition-shadow cursor-pointer">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-muted-foreground"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <circle cx="9" cy="5" r="1.5" />
              <circle cx="9" cy="12" r="1.5" />
              <circle cx="9" cy="19" r="1.5" />
              <circle cx="15" cy="5" r="1.5" />
              <circle cx="15" cy="12" r="1.5" />
              <circle cx="15" cy="19" r="1.5" />
            </svg>
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: statusColors[status] }}
            />
          </div>
          <span className="text-xs text-muted-foreground uppercase tracking-wide">
            {statusLabels[status]}
          </span>
        </div>
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <CardDescription className="line-clamp-1">{description}</CardDescription>
        {labels && labels.length > 0 && (
          <div className="mt-3 flex gap-1.5 overflow-x-auto labels-scroll pb-1">
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

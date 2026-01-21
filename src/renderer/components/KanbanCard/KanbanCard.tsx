import { statusColors, statusLabels } from '../../constants/status';
import type { KanbanCardProps } from './types';

export function KanbanCard({ title, description, status }: KanbanCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-4 w-64 border border-gray-200 hover:shadow-lg transition-shadow cursor-pointer">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-gray-400"
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
        <span className="text-xs text-gray-500 uppercase tracking-wide">
          {statusLabels[status]}
        </span>
      </div>
      <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  );
}

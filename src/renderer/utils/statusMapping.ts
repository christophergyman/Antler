import type { CardStatus } from '@core/types/card';
import type { StatusType } from '../constants/status';

export function mapCardStatusToStatusType(status: CardStatus): StatusType {
  switch (status) {
    case 'idle':
    case 'done':
      return 'green';
    case 'in_progress':
      return 'green';
    case 'waiting':
      return 'yellow';
  }
}

import type { CardStatus } from '@core/types/card';
import type { StatusType } from '../constants/status';

export function mapCardStatusToStatusType(status: CardStatus): StatusType {
  switch (status) {
    case 'idle':
    case 'active':
    case 'completed':
      return 'green';
    case 'paused':
      return 'yellow';
    case 'error':
      return 'red';
  }
}

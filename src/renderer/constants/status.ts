export const statusColors = {
  green: '#10b981',
  yellow: '#eab308',
  red: '#ef4444',
} as const;

export const statusLabels = {
  green: 'Healthy',
  yellow: 'Warning',
  red: 'Critical',
} as const;

export type StatusType = keyof typeof statusColors;

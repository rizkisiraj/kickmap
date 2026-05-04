import type { StockLevel } from '@/types';

export const getColorForStockLevel = (level: StockLevel): string => {
  switch (level) {
    case 'high':   return '#00ff87';
    case 'medium': return '#22c55e';
    case 'low':    return '#f59e0b';
    case 'none':   return '#ef4444';
  }
};

export const STOCK_LEVEL_LEGEND = [
  { color: '#00ff87', label: 'High stock' },
  { color: '#22c55e', label: 'Medium' },
  { color: '#f59e0b', label: 'Low stock' },
  { color: '#ef4444', label: 'No match' },
] as const;

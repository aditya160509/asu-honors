import type { DrawingStyle } from './types';

export const DRAWING_PRESETS: Record<string, DrawingStyle> = {
  support: { color: '#22c55e', lineWidth: 2, lineStyle: 'solid' },
  resistance: { color: '#ef4444', lineWidth: 2, lineStyle: 'solid' },
  trendUp: { color: '#22c55e', lineWidth: 2, lineStyle: 'solid' },
  trendDown: { color: '#ef4444', lineWidth: 2, lineStyle: 'solid' },
  fibonacci: { color: '#a855f7', lineWidth: 1, lineStyle: 'dashed' },
  channel: {
    color: '#3b82f6',
    lineWidth: 1,
    lineStyle: 'solid',
    fillColor: 'rgba(59, 130, 246, 0.05)',
  },
};

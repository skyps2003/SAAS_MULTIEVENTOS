import type { CSSProperties } from 'react';

export const CHART_TOOLTIP_CONTENT_STYLE: CSSProperties = {
  borderRadius: 12,
  border: '1px solid var(--chart-tooltip-border)',
  backgroundColor: 'var(--chart-tooltip-background)',
  color: 'var(--chart-tooltip-text)',
  boxShadow: '0 10px 24px var(--chart-tooltip-shadow)',
  fontSize: 12,
};

export const CHART_TOOLTIP_LABEL_STYLE: CSSProperties = {
  color: 'var(--chart-tooltip-text)',
  fontWeight: 700,
};

export const CHART_TOOLTIP_ITEM_STYLE: CSSProperties = {
  color: 'var(--event-primary)',
  fontWeight: 700,
};

export interface EventPalette {
  color_primario_base?: string | null;
  color_secundario_base?: string | null;
  color_acento_base?: string | null;
}

export const DEFAULT_EVENT_PALETTE = {
  primary: '#526FDF',
  secondary: '#D67A50',
  accent: '#5A9B74',
} as const;

export const SUPER_ADMIN_PALETTE: EventPalette = {
  color_primario_base: '#2563EB',
  color_secundario_base: '#1D4ED8',
  color_acento_base: '#0284C7',
};

const isHexColor = (value: unknown): value is string =>
  typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);

export function applyEventPalette(palette?: EventPalette | null) {
  const root = document.documentElement;
  root.style.setProperty('--event-primary', isHexColor(palette?.color_primario_base) ? palette.color_primario_base : DEFAULT_EVENT_PALETTE.primary);
  root.style.setProperty('--event-secondary', isHexColor(palette?.color_secundario_base) ? palette.color_secundario_base : DEFAULT_EVENT_PALETTE.secondary);
  root.style.setProperty('--event-accent', isHexColor(palette?.color_acento_base) ? palette.color_acento_base : DEFAULT_EVENT_PALETTE.accent);
}

export function applySuperAdminPalette() {
  applyEventPalette(SUPER_ADMIN_PALETTE);
}

export function clearEventPalette() {
  const root = document.documentElement;
  root.style.removeProperty('--event-primary');
  root.style.removeProperty('--event-secondary');
  root.style.removeProperty('--event-accent');
}

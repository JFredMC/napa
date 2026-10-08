import { InjectionToken } from '@angular/core';

export type DealsMode = 'demo' | 'api';
export const MODE_KEY = 'napa:mode';
export const API_URL = new InjectionToken<string | null>('API_URL');
export const DEALS_MODE = new InjectionToken<DealsMode>('DEALS_MODE');

/**
 * Sin URL de API siempre es demo. Con API: `?mode=api|demo` manda y se recuerda; si no, lo
 * último elegido; por defecto demo.
 */
export function resolveMode(
  apiUrl: string | null,
  storage: Storage | undefined,
  search: string,
): DealsMode {
  if (!apiUrl) return 'demo';
  const q = new URLSearchParams(search).get('mode');
  if (q === 'api' || q === 'demo') {
    try {
      storage?.setItem(MODE_KEY, q);
    } catch {
      /* ignore */
    }
    return q;
  }
  try {
    return storage?.getItem(MODE_KEY) === 'api' ? 'api' : 'demo';
  } catch {
    return 'demo';
  }
}

export function switchMode(mode: DealsMode): void {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* ignore */
  }
  const url = new URL(location.href);
  url.searchParams.delete('mode');
  location.assign(url.toString());
}

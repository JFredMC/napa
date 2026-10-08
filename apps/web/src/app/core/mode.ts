import { InjectionToken } from '@angular/core';

export type DealsMode = 'demo' | 'api';
/** Lo que pide la persona: `auto` = API si el servidor responde, si no demo. */
export type ModePreference = DealsMode | 'auto';
export const MODE_KEY = 'napa:mode';
export const API_URL = new InjectionToken<string | null>('API_URL');
export const MODE_PREFERENCE = new InjectionToken<ModePreference>('MODE_PREFERENCE');

/**
 * Sin URL de API siempre es demo. Con API: `?mode=api|demo` manda y se recuerda; si no, lo
 * último elegido; si nunca se eligió, `auto`.
 */
export function resolvePreference(
  apiUrl: string | null,
  storage: Storage | undefined,
  search: string,
): ModePreference {
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
    const saved = storage?.getItem(MODE_KEY);
    return saved === 'api' || saved === 'demo' ? saved : 'auto';
  } catch {
    return 'auto';
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

export interface WakeOptions {
  /** Tiempo total de espera: un servicio gratuito de Render tarda ~30-60 s en despertar. */
  deadlineMs: number;
  /** Pausa entre intentos cuando el servidor responde con error (502/503 mientras arranca). */
  retryMs: number;
  fetch?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

/** Espera a que `/api/health` responda 200 o se acabe el plazo. Devuelve si quedó listo. */
export async function waitForHealth(apiUrl: string, opts: WakeOptions): Promise<boolean> {
  const doFetch = opts.fetch ?? ((input, init) => fetch(input, init));
  const now = opts.now ?? (() => Date.now());
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const end = now() + opts.deadlineMs;
  while (now() < end) {
    try {
      const res = await doFetch(`${apiUrl}/api/health`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(Math.max(1000, end - now())),
      });
      if (res.ok) return true;
    } catch {
      /* dormido, sin red o vencido: se reintenta mientras quede plazo */
    }
    const left = end - now();
    if (left <= 0) break;
    await sleep(Math.min(opts.retryMs, left));
  }
  return false;
}

import { InjectionToken } from '@angular/core';
import type { Offer } from '@napa/deals-engine';

/** Foto de precios reales (solo ofertas `live`) que genera scripts/snapshot.mjs. */
export interface Snapshot {
  fetchedAt: string | null;
  offers: Offer[];
}

/** Se carga aparte (chunk propio) para no inflar el bundle inicial. */
export function loadSnapshot(): Promise<Snapshot> {
  return import('../../snapshot.json').then((m) => m.default as unknown as Snapshot);
}

export const SNAPSHOT_LOADER = new InjectionToken<() => Promise<Snapshot>>('SNAPSHOT_LOADER', {
  factory: () => loadSnapshot,
});

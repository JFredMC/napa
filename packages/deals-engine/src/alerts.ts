import type { Offer } from './types';

export interface Watch {
  productKey: string;
  /** Avisar cuando el mejor precio sea menor o igual a esto (COP). */
  target: number;
  /** Mejor precio cuando se creó la alerta. */
  priceAtCreation: number;
  createdAt: string;
}

export interface WatchStatus {
  watch: Watch;
  best: Offer | null;
  triggered: boolean;
  /** Cambio frente al precio al crear la alerta (negativo = bajó). */
  change: number;
}

/** Evalúa la lista de seguimiento contra las ofertas actuales. */
export function checkWatches(watches: readonly Watch[], offers: readonly Offer[]): WatchStatus[] {
  return watches.map((watch) => {
    const best = offers
      .filter((o) => o.productKey === watch.productKey)
      .reduce<Offer | null>((min, o) => (!min || o.price < min.price ? o : min), null);
    return {
      watch,
      best,
      triggered: !!best && best.price <= watch.target,
      change: best ? best.price - watch.priceAtCreation : 0,
    };
  });
}

/** Precio objetivo sugerido: el mínimo de 90 días si es menor, o 10 % menos que hoy. */
export function suggestTarget(current: number, min90?: number): number {
  const base = min90 && min90 < current ? min90 : current * 0.9;
  return Math.max(100, Math.round(base / 100) * 100);
}

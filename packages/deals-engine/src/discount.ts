import type { Offer } from './types';
import { historyStats, type HistoryStats } from './history';
import { deltaPct, discountPct } from './money';

/**
 * - `real`: baja de verdad frente al precio habitual.
 * - `minimo`: real y además es el precio más bajo de 90 días.
 * - `inflado`: el precio "antes" nunca se cobró o el precio actual no es menor al habitual.
 * - `dudoso`: descuento enorme y sin historial para verificarlo.
 * - `sin-historial`: trae descuento pero no hay datos para confirmarlo.
 * - `sin-descuento`: no anuncia rebaja.
 */
export type DiscountVerdict =
  'real' | 'minimo' | 'inflado' | 'dudoso' | 'sin-historial' | 'sin-descuento';

export interface DiscountAnalysis {
  verdict: DiscountVerdict;
  /** % que anuncia la tienda (precio vs precio "antes"). */
  declaredPct: number;
  /** % frente al precio habitual de las últimas semanas (puede ser negativo). Null sin historial. */
  realPct: number | null;
  /** Precio habitual (mediana de hace 90 a 8 días). */
  usualPrice: number | null;
  stats: HistoryStats | null;
  reasons: string[];
}

/** Mínimo de días de historial para opinar sobre el precio "antes". */
export const MIN_HISTORY_DAYS = 21;
/** Margen sobre el precio más alto cobrado antes de considerar inflado el "antes". */
export const INFLATION_TOLERANCE = 1.05;
/** Desde aquí, un descuento sin historial se marca como dudoso. */
export const SUSPICIOUS_PCT = 60;

const cop = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

/** Detecta descuentos con el precio "antes" inflado comparando contra el historial de precios. */
export function analyzeDiscount(offer: Offer): DiscountAnalysis {
  const declaredPct = discountPct(offer.price, offer.listPrice);
  const stats = offer.history?.length ? historyStats(offer.history) : null;
  const reasons: string[] = [];

  if (!stats || stats.days < MIN_HISTORY_DAYS) {
    if (declaredPct === 0) {
      return {
        verdict: 'sin-descuento',
        declaredPct,
        realPct: null,
        usualPrice: null,
        stats,
        reasons: ['La tienda no anuncia rebaja.'],
      };
    }
    const dubious = declaredPct >= SUSPICIOUS_PCT;
    reasons.push(
      dubious
        ? `Anuncia ${declaredPct}% sin historial para verificarlo: desconfía del precio "antes".`
        : 'Sin historial suficiente para confirmar el precio "antes".',
    );
    return {
      verdict: dubious ? 'dudoso' : 'sin-historial',
      declaredPct,
      realPct: null,
      usualPrice: null,
      stats,
      reasons,
    };
  }

  const usual = stats.usual;
  const realPct = deltaPct(offer.price, usual);
  const neverCharged = declaredPct > 0 && offer.listPrice > stats.maxBefore * INFLATION_TOLERANCE;
  const notCheaper = declaredPct > 0 && realPct < 3;

  if (neverCharged) {
    reasons.push(
      `El precio "antes" (${cop(offer.listPrice)}) no se cobró en los últimos 90 días; el más alto fue ${cop(stats.maxBefore)}.`,
    );
  }
  if (notCheaper) {
    reasons.push(
      realPct < 0
        ? `Hoy está ${Math.abs(realPct)}% más caro que su precio habitual (${cop(usual)}).`
        : `Prácticamente igual a su precio habitual (${cop(usual)}).`,
    );
  }
  if (neverCharged || notCheaper) {
    return { verdict: 'inflado', declaredPct, realPct, usualPrice: usual, stats, reasons };
  }

  if (declaredPct === 0 && realPct < 3) {
    reasons.push(`Sin rebaja: precio habitual ${cop(usual)}.`);
    return { verdict: 'sin-descuento', declaredPct, realPct, usualPrice: usual, stats, reasons };
  }

  reasons.push(`Está ${realPct}% por debajo de su precio habitual (${cop(usual)}).`);
  if (declaredPct > realPct + 5) {
    reasons.push(
      `La tienda anuncia ${declaredPct}%, pero frente a lo que se venía cobrando es ${realPct}%.`,
    );
  }
  if (stats.isLowest90) reasons.push('Es el precio más bajo de los últimos 90 días.');
  return {
    verdict: stats.isLowest90 ? 'minimo' : 'real',
    declaredPct,
    realPct,
    usualPrice: usual,
    stats,
    reasons,
  };
}

export const VERDICT_LABEL: Record<DiscountVerdict, string> = {
  real: 'Descuento real',
  minimo: 'Mínimo de 90 días',
  inflado: 'Descuento inflado',
  dudoso: 'Descuento dudoso',
  'sin-historial': 'Sin historial',
  'sin-descuento': 'Sin descuento',
};

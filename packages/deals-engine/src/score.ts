import type { Offer, StoreInfo } from './types';
import { analyzeDiscount, type DiscountAnalysis } from './discount';
import { clamp } from './money';
import { shippingFor } from './shipping';

export interface ScorePart {
  key: 'ahorro' | 'tiendas' | 'historial' | 'confianza' | 'envio';
  label: string;
  points: number;
  max: number;
}

export type Grade = 'excelente' | 'buena' | 'regular' | 'floja';

export interface DealScore {
  score: number;
  grade: Grade;
  parts: ScorePart[];
  /** Penalización aplicada (descuento inflado o dudoso). */
  capped: boolean;
}

export interface ScoredOffer {
  offer: Offer;
  analysis: DiscountAnalysis;
  deal: DealScore;
  /** Precio + envío para una sola unidad. */
  landed: number;
  /** Precio más bajo (con envío) del mismo producto en otras tiendas, si existe. */
  bestPeer: number | null;
}

/** Precio puesto en casa para comprar solo esta unidad. */
export function landedPrice(offer: Offer, store: StoreInfo | undefined): number {
  return offer.price + shippingFor(store?.shipping, offer.price);
}

export function gradeOf(score: number): Grade {
  if (score >= 75) return 'excelente';
  if (score >= 55) return 'buena';
  if (score >= 35) return 'regular';
  return 'floja';
}

/**
 * Puntaje 0–100 de qué tan buena es una oferta, no qué tan grande es el tachado:
 * - Ahorro real (35): % frente al precio habitual; sin historial cuenta el % anunciado a medias.
 * - Frente a otras tiendas (25): precio con envío contra la opción más barata del mismo producto.
 * - Historial (15): qué tan cerca está del mínimo de 90 días.
 * - Confianza (15): calificación de la tienda.
 * - Envío (10): costo y tiempo de entrega.
 * Un descuento inflado queda en máximo 30; uno dudoso, en máximo 50.
 */
export function dealScore(
  offer: Offer,
  store: StoreInfo | undefined,
  peerLanded: readonly number[] = [],
  analysis: DiscountAnalysis = analyzeDiscount(offer),
): DealScore {
  const landed = landedPrice(offer, store);
  const stats = analysis.stats;

  const savingPct = analysis.realPct ?? analysis.declaredPct * 0.5;
  const ahorro = 35 * clamp(savingPct / 40);

  const best = peerLanded.length ? Math.min(...peerLanded, landed) : null;
  const tiendas = best === null ? 12.5 : 25 * clamp((best / landed - 0.8) / 0.2);

  let historial = 7;
  if (stats && analysis.realPct !== null) {
    const span = stats.max90 - stats.min90;
    historial = stats.isLowest90
      ? 15
      : span > 0
        ? 15 * clamp((stats.max90 - offer.price) / span)
        : 7;
  }

  const confianza = store ? 15 * clamp((store.rating - 3.5) / 1.5) : 5;

  let envio = 10;
  if (store) {
    const cost = shippingFor(store.shipping, offer.price);
    envio =
      7 * clamp(1 - cost / Math.max(offer.price, 1) / 0.25) +
      3 * clamp(1 - (store.shipping.maxDays - 1) / 9);
  }

  const parts: ScorePart[] = [
    { key: 'ahorro', label: 'Ahorro real', points: ahorro, max: 35 },
    { key: 'tiendas', label: 'Frente a otras tiendas', points: tiendas, max: 25 },
    { key: 'historial', label: 'Historial de precio', points: historial, max: 15 },
    { key: 'confianza', label: 'Confianza de la tienda', points: confianza, max: 15 },
    { key: 'envio', label: 'Envío', points: envio, max: 10 },
  ].map((p) => ({ ...p, points: Math.round(p.points * 10) / 10 })) as ScorePart[];

  let score = Math.round(parts.reduce((sum, p) => sum + p.points, 0));
  let capped = false;
  if (analysis.verdict === 'inflado' && score > 30) {
    score = 30;
    capped = true;
  } else if (analysis.verdict === 'dudoso' && score > 50) {
    score = 50;
    capped = true;
  }
  return { score, grade: gradeOf(score), parts, capped };
}

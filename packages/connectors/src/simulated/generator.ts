import { parseSize, type CategoryId, type Offer, type PricePoint } from '@napa/deals-engine';
import { STORES } from '../stores';
import { CATALOG, type ProductTemplate } from './catalog';
import { between, seeded, shelfPrice } from './random';

/** Cómo se comporta una tienda simulada. */
export interface StoreProfile {
  /** Multiplicador sobre el precio base (D1 < 1, Carulla > 1). */
  factor: number;
  /** Variación aleatoria por producto (± fracción). */
  spread: number;
  /** Probabilidad de tener una promo real vigente. */
  promoRate: number;
  /** Probabilidad de un descuento inflado (precio "antes" inventado o subido antes de rebajar). */
  inflatedRate: number;
  /** Profundidad máxima de una promo real (fracción). */
  maxPromo: number;
}

export const HISTORY_DAYS = 120;
const GROCERY = new Set<CategoryId>([
  'despensa',
  'lacteos',
  'bebidas',
  'aseo-hogar',
  'cuidado-personal',
  'bebe',
  'mascotas',
]);
const DAY = 86_400_000;

function dates(today: string, n: number): string[] {
  const end = Date.parse(`${today}T00:00:00Z`);
  return Array.from({ length: n }, (_, i) =>
    new Date(end - (n - 1 - i) * DAY).toISOString().slice(0, 10),
  );
}

export function carries(storeId: string, t: ProductTemplate): boolean {
  if (t.stores) return t.stores.includes(storeId);
  return STORES[storeId]?.categories.includes(t.category) ?? false;
}

/**
 * Genera la oferta simulada de un producto en una tienda, con 120 días de historial:
 * precio que se mueve poco, promos esporádicas y, al final, uno de tres escenarios
 * (promo real, descuento inflado o precio normal). Determinista por tienda, producto y día.
 */
export function simulateOffer(
  storeId: string,
  t: ProductTemplate,
  profile: StoreProfile,
  today: string,
): Offer {
  const rng = seeded(`${storeId}:${t.key}`);
  const regular = t.base * profile.factor * (1 + between(rng, -profile.spread, profile.spread));
  const days = dates(today, HISTORY_DAYS);
  const raw: number[] = [];

  // Precio habitual: escalones pequeños cada 12–20 días y promos cortas esporádicas.
  let level = regular * between(rng, 0.97, 1.03);
  let nextStep = Math.floor(between(rng, 8, 20));
  let promoLeft = 0;
  let promoDepth = 0;
  for (let i = 0; i < HISTORY_DAYS; i += 1) {
    if (i === nextStep) {
      level = regular * between(rng, 0.96, 1.04);
      nextStep = i + Math.floor(between(rng, 12, 20));
    }
    if (!promoLeft && i < HISTORY_DAYS - 14 && rng() < 0.025) {
      promoLeft = Math.floor(between(rng, 4, 9));
      promoDepth = between(rng, 0.06, Math.min(0.18, profile.maxPromo * 0.6));
    }
    raw.push(promoLeft ? level * (1 - promoDepth) : level);
    if (promoLeft) promoLeft -= 1;
  }

  // Escenario vigente.
  const roll = rng();
  let listPrice: number;
  const last = HISTORY_DAYS - 1;
  if (roll < profile.inflatedRate) {
    if (rng() < 0.5) {
      // A: precio "antes" que nunca se cobró.
      const now = regular * between(rng, 0.96, 1.01);
      for (let i = last - 2; i <= last; i += 1) raw[i] = now;
      listPrice = regular * between(rng, 1.45, 2.1);
    } else {
      // B: suben el precio unos días y luego "rebajan" al mismo valor de siempre.
      const raised = regular * between(rng, 1.2, 1.35);
      for (let i = last - 12; i <= last - 3; i += 1) raw[i] = raised;
      const now = regular * between(rng, 0.98, 1.03);
      for (let i = last - 2; i <= last; i += 1) raw[i] = now;
      listPrice = raised;
    }
  } else if (roll < profile.inflatedRate + profile.promoRate) {
    const depth = between(rng, 0.1, profile.maxPromo);
    const length = Math.floor(between(rng, 2, 7));
    for (let i = last - length + 1; i <= last; i += 1) raw[i] = regular * (1 - depth);
    // A veces hubo una promo más profunda hace unas semanas: la de hoy es real, pero no el mínimo.
    if (rng() < 0.45) {
      const start = last - Math.floor(between(rng, 20, 80));
      for (let i = start; i < start + 5; i += 1)
        raw[i] = regular * (1 - Math.min(depth + 0.06, 0.6));
    }
    listPrice = regular;
  } else {
    listPrice = raw[last] ?? regular;
  }

  const history: PricePoint[] = days.map((date, i) => ({
    date,
    price: shelfPrice(raw[i] ?? regular),
  }));
  const price = history[last]?.price ?? shelfPrice(regular);
  const list = Math.max(price, shelfPrice(listPrice));
  const size = GROCERY.has(t.category) ? parseSize(t.title) : null;

  return {
    id: `${storeId}-${t.key}`,
    productKey: t.key,
    storeId,
    title: t.title,
    brand: t.brand,
    category: t.category,
    price,
    listPrice: list,
    ...(size ? { size } : {}),
    source: 'simulated',
    observedAt: `${today}T08:00:00-05:00`,
    history,
    stock: Math.floor(between(rng, 0, 1) < 0.12 ? between(rng, 1, 6) : between(rng, 8, 200)),
  };
}

/** Todas las ofertas simuladas de una tienda para un día. */
export function simulateStore(storeId: string, profile: StoreProfile, today: string): Offer[] {
  return CATALOG.filter((t) => carries(storeId, t)).map((t) =>
    simulateOffer(storeId, t, profile, today),
  );
}

/** Fecha de hoy en Colombia (UTC−5), YYYY-MM-DD. */
export function todayInBogota(now = new Date()): string {
  return new Date(now.getTime() - 5 * 3_600_000).toISOString().slice(0, 10);
}

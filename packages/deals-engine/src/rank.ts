import type { CategoryId, Offer, StoreInfo } from './types';
import { analyzeDiscount } from './discount';
import { groupByProduct } from './match';
import { dealScore, landedPrice, type ScoredOffer } from './score';
import { matchesQuery } from './text';
import { unitPrice } from './units';
import { savings } from './money';

export type StoreMap = Readonly<Record<string, StoreInfo>>;

/** Analiza y puntúa cada oferta comparándola con el mismo producto en las otras tiendas. */
export function scoreOffers(offers: readonly Offer[], stores: StoreMap): ScoredOffer[] {
  const landed = new Map(offers.map((o) => [o.id, landedPrice(o, stores[o.storeId])]));
  const groups = groupByProduct(offers);
  return offers.map((offer) => {
    const peers = (groups.get(offer.productKey) ?? [])
      .filter((p) => p.id !== offer.id)
      .map((p) => landed.get(p.id) ?? landedPrice(p, stores[p.storeId]));
    const analysis = analyzeDiscount(offer);
    return {
      offer,
      analysis,
      deal: dealScore(offer, stores[offer.storeId], peers, analysis),
      landed: landed.get(offer.id) ?? landedPrice(offer, stores[offer.storeId]),
      bestPeer: peers.length ? Math.min(...peers) : null,
    };
  });
}

export interface OfferFilter {
  query?: string;
  categories?: readonly CategoryId[];
  stores?: readonly string[];
  minDiscount?: number;
  maxPrice?: number;
  /** Oculta descuentos inflados y dudosos. */
  onlyHonest?: boolean;
}

export function filterOffers(items: readonly ScoredOffer[], f: OfferFilter): ScoredOffer[] {
  return items.filter(({ offer, analysis }) => {
    if (f.query && !matchesQuery(`${offer.title} ${offer.brand} ${offer.category}`, f.query))
      return false;
    if (f.categories?.length && !f.categories.includes(offer.category)) return false;
    if (f.stores?.length && !f.stores.includes(offer.storeId)) return false;
    if (f.minDiscount && analysis.declaredPct < f.minDiscount) return false;
    if (f.maxPrice && offer.price > f.maxPrice) return false;
    if (f.onlyHonest && (analysis.verdict === 'inflado' || analysis.verdict === 'dudoso'))
      return false;
    return true;
  });
}

export type SortKey = 'score' | 'price' | 'discount' | 'savings' | 'unit';

const unitValue = (s: ScoredOffer) =>
  unitPrice(s.offer.price, s.offer.size)?.value ?? Number.POSITIVE_INFINITY;

const SORTERS: Record<SortKey, (a: ScoredOffer, b: ScoredOffer) => number> = {
  score: (a, b) => b.deal.score - a.deal.score || a.landed - b.landed,
  price: (a, b) => a.landed - b.landed,
  discount: (a, b) =>
    (b.analysis.realPct ?? -1) - (a.analysis.realPct ?? -1) ||
    b.analysis.declaredPct - a.analysis.declaredPct,
  savings: (a, b) =>
    savings(b.offer.price, b.offer.listPrice) - savings(a.offer.price, a.offer.listPrice),
  unit: (a, b) => unitValue(a) - unitValue(b) || a.landed - b.landed,
};

export function sortOffers(items: readonly ScoredOffer[], by: SortKey = 'score'): ScoredOffer[] {
  return [...items].sort(SORTERS[by]);
}

/** La mejor oferta de cada producto (para no repetir el mismo artículo en el ranking). */
export function bestPerProduct(items: readonly ScoredOffer[]): ScoredOffer[] {
  const best = new Map<string, ScoredOffer>();
  for (const item of items) {
    const current = best.get(item.offer.productKey);
    if (!current || SORTERS.score(item, current) < 0) best.set(item.offer.productKey, item);
  }
  return [...best.values()];
}

/** Top N por categoría, ordenado por puntaje y sin repetir producto. */
export function topByCategory(
  items: readonly ScoredOffer[],
  n = 3,
): Map<CategoryId, ScoredOffer[]> {
  const out = new Map<CategoryId, ScoredOffer[]>();
  for (const item of sortOffers(bestPerProduct(items))) {
    const list = out.get(item.offer.category) ?? [];
    if (list.length < n) list.push(item);
    out.set(item.offer.category, list);
  }
  return out;
}

export interface StoreComparisonRow {
  item: ScoredOffer;
  /** Diferencia con la opción más barata (con envío), en COP. */
  diff: number;
  cheapest: boolean;
}

/** Mismo producto en todas las tiendas, del más barato al más caro (precio con envío). */
export function compareAcrossStores(
  items: readonly ScoredOffer[],
  productKey: string,
): StoreComparisonRow[] {
  const rows = items
    .filter((i) => i.offer.productKey === productKey)
    .sort((a, b) => a.landed - b.landed);
  const min = rows[0]?.landed ?? 0;
  return rows.map((item, i) => ({ item, diff: item.landed - min, cheapest: i === 0 }));
}

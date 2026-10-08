import type { Offer } from './types';
import { shippingFor } from './shipping';
import type { StoreMap } from './rank';

export interface BasketLine {
  productKey: string;
  qty: number;
}

export interface BasketAssignment {
  productKey: string;
  qty: number;
  offer: Offer;
  subtotal: number;
}

export interface StoreLeg {
  storeId: string;
  items: BasketAssignment[];
  subtotal: number;
  shipping: number;
}

export interface BasketPlan {
  stores: string[];
  legs: StoreLeg[];
  items: number;
  subtotal: number;
  shipping: number;
  total: number;
  /** Productos que ninguna tienda del plan vende. */
  missing: string[];
}

export interface BasketResult {
  /** Plan más barato (con envíos) respetando el máximo de tiendas. */
  best: BasketPlan | null;
  /** Mejor plan comprando todo en una sola tienda. */
  bestSingle: BasketPlan | null;
  /** Cada tienda por separado (puede tener faltantes), del más barato al más caro. */
  singles: BasketPlan[];
  /** Ahorro de dividir la compra frente a la mejor tienda única. */
  savings: number;
}

export interface BasketOptions {
  /** Máximo de tiendas en las que se divide la compra (1–4). */
  maxStores?: number;
  /** Restringe a estas tiendas. */
  allowed?: readonly string[];
}

function combinations<T>(items: readonly T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (items.length < k) return [];
  const [head, ...rest] = items;
  if (head === undefined) return [];
  return [...combinations(rest, k - 1).map((c) => [head, ...c]), ...combinations(rest, k)];
}

function cost(choice: Map<string, Offer>, lines: readonly BasketLine[], stores: StoreMap): number {
  const sub = new Map<string, number>();
  let total = 0;
  for (const line of lines) {
    const offer = choice.get(line.productKey);
    if (!offer) continue;
    const s = offer.price * line.qty;
    total += s;
    sub.set(offer.storeId, (sub.get(offer.storeId) ?? 0) + s);
  }
  for (const [storeId, s] of sub) total += shippingFor(stores[storeId]?.shipping, s);
  return total;
}

function buildPlan(
  choice: Map<string, Offer>,
  lines: readonly BasketLine[],
  stores: StoreMap,
): BasketPlan {
  const legs = new Map<string, StoreLeg>();
  const missing: string[] = [];
  for (const line of lines) {
    const offer = choice.get(line.productKey);
    if (!offer) {
      missing.push(line.productKey);
      continue;
    }
    const leg = legs.get(offer.storeId) ?? {
      storeId: offer.storeId,
      items: [],
      subtotal: 0,
      shipping: 0,
    };
    const subtotal = offer.price * line.qty;
    leg.items.push({ productKey: line.productKey, qty: line.qty, offer, subtotal });
    leg.subtotal += subtotal;
    legs.set(offer.storeId, leg);
  }
  const list = [...legs.values()].map((l) => ({
    ...l,
    shipping: shippingFor(stores[l.storeId]?.shipping, l.subtotal),
  }));
  list.sort((a, b) => b.subtotal - a.subtotal);
  const subtotal = list.reduce((s, l) => s + l.subtotal, 0);
  const shipping = list.reduce((s, l) => s + l.shipping, 0);
  return {
    stores: list.map((l) => l.storeId),
    legs: list,
    items: lines.reduce((s, l) => s + (choice.has(l.productKey) ? l.qty : 0), 0),
    subtotal,
    shipping,
    total: subtotal + shipping,
    missing,
  };
}

/**
 * Plan para un subconjunto de tiendas: cada producto va a su tienda más barata y luego una
 * búsqueda local mueve productos entre tiendas mientras baje el total (así se aprovechan los
 * umbrales de envío gratis o se evita pagar un envío por un solo artículo).
 */
function planFor(
  subset: readonly string[],
  lines: readonly BasketLine[],
  byKey: Map<string, Offer[]>,
  stores: StoreMap,
): BasketPlan {
  const allowed = new Set(subset);
  const options = new Map<string, Offer[]>();
  const choice = new Map<string, Offer>();
  for (const line of lines) {
    const opts = (byKey.get(line.productKey) ?? [])
      .filter((o) => allowed.has(o.storeId))
      .sort((a, b) => a.price - b.price);
    options.set(line.productKey, opts);
    if (opts[0]) choice.set(line.productKey, opts[0]);
  }
  let current = cost(choice, lines, stores);
  for (let pass = 0; pass < 20; pass += 1) {
    let improved = false;
    for (const line of lines) {
      for (const alt of options.get(line.productKey) ?? []) {
        const prev = choice.get(line.productKey);
        if (!prev || alt === prev) continue;
        choice.set(line.productKey, alt);
        const next = cost(choice, lines, stores);
        if (next < current - 0.5) {
          current = next;
          improved = true;
        } else {
          choice.set(line.productKey, prev);
        }
      }
    }
    if (!improved) break;
  }
  return buildPlan(choice, lines, stores);
}

const better = (a: BasketPlan, b: BasketPlan | null) =>
  !b ||
  a.missing.length < b.missing.length ||
  (a.missing.length === b.missing.length && a.total < b.total);

/** Divide la lista de compras entre tiendas para pagar lo menos posible, envíos incluidos. */
export function optimizeBasket(
  lines: readonly BasketLine[],
  offers: readonly Offer[],
  stores: StoreMap,
  options: BasketOptions = {},
): BasketResult {
  const wanted = lines.filter((l) => l.qty > 0);
  const keys = new Set(wanted.map((l) => l.productKey));
  const allowed = options.allowed ? new Set(options.allowed) : null;
  const byKey = new Map<string, Offer[]>();
  for (const o of offers) {
    if (!keys.has(o.productKey) || (allowed && !allowed.has(o.storeId))) continue;
    byKey.set(o.productKey, [...(byKey.get(o.productKey) ?? []), o]);
  }
  const candidates = [...new Set([...byKey.values()].flat().map((o) => o.storeId))].sort();
  if (!wanted.length || !candidates.length)
    return { best: null, bestSingle: null, singles: [], savings: 0 };

  const singles = candidates
    .map((s) => planFor([s], wanted, byKey, stores))
    .sort((a, b) => a.missing.length - b.missing.length || a.total - b.total);
  const complete = singles.filter((p) => !p.missing.length);
  const bestSingle = complete[0] ?? null;

  const maxStores = Math.min(Math.max(options.maxStores ?? 3, 1), 4, candidates.length);
  let best: BasketPlan | null = null;
  for (let k = 1; k <= maxStores; k += 1) {
    for (const subset of combinations(candidates, k)) {
      const plan = planFor(subset, wanted, byKey, stores);
      if (better(plan, best)) best = plan;
    }
  }
  const savings =
    best && bestSingle && !best.missing.length ? Math.max(0, bestSingle.total - best.total) : 0;
  return { best, bestSingle, singles, savings };
}

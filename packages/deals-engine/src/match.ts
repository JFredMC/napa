import type { Offer } from './types';
import { norm, tokens } from './text';
import { parseSize } from './units';

function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  return inter / (a.size + b.size - inter);
}

function sameBrand(a: Offer, b: Offer): boolean {
  const x = norm(a.brand);
  const y = norm(b.brand);
  return !x || !y || x === y || x.includes(y) || y.includes(x);
}

function sameSize(a: Offer, b: Offer): boolean {
  const x = a.size ?? parseSize(a.title);
  const y = b.size ?? parseSize(b.title);
  if (!x || !y) return !x && !y;
  return x.unit === y.unit && Math.abs(x.amount - y.amount) / Math.max(x.amount, y.amount) < 0.02;
}

/** ¿Dos ofertas de tiendas distintas son el mismo producto? Marca + tamaño + títulos parecidos. */
export function sameProduct(a: Offer, b: Offer, threshold = 0.6): boolean {
  if (a.storeId === b.storeId) return false;
  if (!sameBrand(a, b) || !sameSize(a, b)) return false;
  return (
    jaccard(new Set(tokens(`${a.brand} ${a.title}`)), new Set(tokens(`${b.brand} ${b.title}`))) >=
    threshold
  );
}

/**
 * Reasigna `productKey` agrupando el mismo producto entre tiendas (una oferta por tienda en
 * cada grupo). Sirve para resultados de APIs reales, donde cada tienda trae su propio id.
 */
export function clusterOffers(offers: readonly Offer[]): Offer[] {
  const groups: Offer[][] = [];
  for (const offer of offers) {
    const group = groups.find(
      (g) => !g.some((o) => o.storeId === offer.storeId) && g.some((o) => sameProduct(o, offer)),
    );
    if (group) group.push(offer);
    else groups.push([offer]);
  }
  return groups.flatMap(([first, ...rest]) =>
    first ? [first, ...rest].map((o) => ({ ...o, productKey: first.productKey })) : [],
  );
}

/** Ofertas agrupadas por producto. */
export function groupByProduct<T extends { productKey: string }>(
  items: readonly T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const list = map.get(item.productKey);
    if (list) list.push(item);
    else map.set(item.productKey, [item]);
  }
  return map;
}

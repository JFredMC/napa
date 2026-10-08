import type { Offer, PricePoint, StoreInfo } from './types';

/** Utilidades solo para pruebas (no se exportan desde index). */
export function store(id: string, over: Partial<StoreInfo> = {}): StoreInfo {
  return {
    id,
    name: id,
    rating: 4.5,
    ratingCount: 1000,
    shipping: { cost: 0, minDays: 1, maxDays: 2 },
    ...over,
  };
}

export function offer(over: Partial<Offer> = {}): Offer {
  return {
    id: over.id ?? `${over.storeId ?? 's1'}-${over.productKey ?? 'p1'}`,
    productKey: 'p1',
    storeId: 's1',
    title: 'Arroz blanco 1 kg',
    brand: 'La Cosecha',
    category: 'despensa',
    price: 4000,
    listPrice: 4000,
    source: 'simulated',
    observedAt: '2026-10-07T12:00:00Z',
    ...over,
  };
}

/** Historial diario que termina el 2026-10-07; `price(daysAgo)` da el precio de cada día. */
export function history(days: number, price: (daysAgo: number) => number): PricePoint[] {
  const end = Date.parse('2026-10-07T00:00:00Z');
  return Array.from({ length: days }, (_, i) => {
    const ago = days - 1 - i;
    return { date: new Date(end - ago * 86_400_000).toISOString().slice(0, 10), price: price(ago) };
  });
}

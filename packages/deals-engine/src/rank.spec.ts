import { describe, expect, it } from 'vitest';
import {
  bestPerProduct,
  compareAcrossStores,
  filterOffers,
  scoreOffers,
  sortOffers,
  topByCategory,
} from './rank';
import { history, offer, store } from './testing';

const stores = {
  a: store('a', { rating: 4.7 }),
  b: store('b', { rating: 4.2, shipping: { cost: 8000, freeFrom: 60000, minDays: 2, maxDays: 4 } }),
  c: store('c', { rating: 3.6 }),
};

const offers = [
  offer({
    id: 'a-arroz',
    storeId: 'a',
    productKey: 'arroz',
    price: 3800,
    listPrice: 4500,
    history: history(60, (d) => (d < 3 ? 3800 : 4500)),
  }),
  offer({ id: 'b-arroz', storeId: 'b', productKey: 'arroz', price: 3500, listPrice: 3500 }),
  offer({
    id: 'c-arroz',
    storeId: 'c',
    productKey: 'arroz',
    price: 3600,
    listPrice: 9000,
    history: history(60, (d) => (d < 3 ? 3600 : 3700)),
  }),
  offer({
    id: 'a-tv',
    storeId: 'a',
    productKey: 'tv',
    title: 'Televisor 50 pulgadas',
    category: 'tecnologia',
    size: undefined,
    price: 1_500_000,
    listPrice: 2_000_000,
    history: history(60, (d) => (d < 3 ? 1_500_000 : 1_900_000)),
  }),
];

describe('ranking', () => {
  const scored = scoreOffers(offers, stores);

  it('compara cada oferta con el mismo producto en otras tiendas (con envío)', () => {
    const b = scored.find((s) => s.offer.id === 'b-arroz')!;
    expect(b.landed).toBe(11500);
    const a = scored.find((s) => s.offer.id === 'a-arroz')!;
    expect(a.bestPeer).toBe(3600);
  });

  it('filtra por texto, categoría, tienda, % mínimo y honestidad', () => {
    expect(filterOffers(scored, { query: 'arroz' })).toHaveLength(3);
    expect(filterOffers(scored, { categories: ['tecnologia'] })).toHaveLength(1);
    expect(filterOffers(scored, { stores: ['a'] })).toHaveLength(2);
    expect(filterOffers(scored, { minDiscount: 20 }).map((s) => s.offer.id)).toEqual([
      'c-arroz',
      'a-tv',
    ]);
    expect(filterOffers(scored, { onlyHonest: true }).map((s) => s.offer.id)).not.toContain(
      'c-arroz',
    );
    expect(filterOffers(scored, { maxPrice: 10000 })).toHaveLength(3);
  });

  it('ordena por puntaje, precio, descuento, ahorro y precio por unidad', () => {
    expect(sortOffers(scored, 'price')[0]!.offer.id).toBe('c-arroz');
    expect(sortOffers(scored, 'savings')[0]!.offer.id).toBe('a-tv');
    expect(sortOffers(scored, 'discount')[0]!.offer.id).toBe('a-tv');
    expect(sortOffers(scored, 'unit').at(-1)!.offer.id).toBe('a-tv');
    const byScore = sortOffers(scored);
    expect(byScore[0]!.deal.score).toBeGreaterThanOrEqual(byScore[1]!.deal.score);
  });

  it('una oferta por producto y top por categoría', () => {
    expect(bestPerProduct(scored)).toHaveLength(2);
    const top = topByCategory(scored, 1);
    expect(top.get('despensa')).toHaveLength(1);
    expect(top.get('tecnologia')![0]!.offer.id).toBe('a-tv');
  });

  it('comparación entre tiendas, de más barata a más cara', () => {
    const rows = compareAcrossStores(scored, 'arroz');
    expect(rows.map((r) => r.item.offer.storeId)).toEqual(['c', 'a', 'b']);
    expect(rows[0]!.cheapest).toBe(true);
    expect(rows[2]!.diff).toBe(11500 - 3600);
  });
});

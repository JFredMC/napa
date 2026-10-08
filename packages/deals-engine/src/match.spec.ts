import { describe, expect, it } from 'vitest';
import { clusterOffers, groupByProduct, sameProduct } from './match';
import { offer } from './testing';

describe('emparejamiento entre tiendas', () => {
  const a = offer({
    id: 'a1',
    storeId: 'a',
    productKey: 'a1',
    title: 'Atún en agua lomitos 160 g',
    brand: 'Mar Azul',
  });
  const b = offer({
    id: 'b1',
    storeId: 'b',
    productKey: 'b1',
    title: 'Atun lomitos en agua 160g',
    brand: 'MAR AZUL',
  });
  const c = offer({
    id: 'c1',
    storeId: 'c',
    productKey: 'c1',
    title: 'Atún en agua lomitos 354 g',
    brand: 'Mar Azul',
  });
  const d = offer({
    id: 'd1',
    storeId: 'd',
    productKey: 'd1',
    title: 'Atún en agua lomitos 160 g',
    brand: 'Otra Marca',
  });

  it('mismo producto si coinciden marca, tamaño y título', () => {
    expect(sameProduct(a, b)).toBe(true);
    expect(sameProduct(a, c)).toBe(false);
    expect(sameProduct(a, d)).toBe(false);
    expect(sameProduct(a, { ...b, storeId: 'a' })).toBe(false);
  });

  it('agrupa y reasigna productKey', () => {
    const out = clusterOffers([a, b, c, d]);
    const groups = groupByProduct(out);
    expect(groups.size).toBe(3);
    expect(groups.get('a1')!.map((o) => o.id)).toEqual(['a1', 'b1']);
  });
});

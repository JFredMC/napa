import { describe, expect, it } from 'vitest';
import { optimizeBasket } from './basket';
import { offer, store } from './testing';

const stores = {
  a: store('a', { shipping: { cost: 5000, freeFrom: 50000, minDays: 1, maxDays: 1 } }),
  b: store('b', { shipping: { cost: 5000, freeFrom: 50000, minDays: 1, maxDays: 1 } }),
  c: store('c', { shipping: { cost: 0, minDays: 0, maxDays: 0, pickup: true } }),
};

const o = (storeId: string, productKey: string, price: number) =>
  offer({ id: `${storeId}-${productKey}`, storeId, productKey, price, listPrice: price });

describe('optimizador de canasta', () => {
  it('divide entre tiendas cuando sale más barato, contando envíos', () => {
    const offers = [
      o('a', 'arroz', 10000),
      o('a', 'aceite', 30000),
      o('b', 'arroz', 20000),
      o('b', 'aceite', 12000),
    ];
    const r = optimizeBasket(
      [
        { productKey: 'arroz', qty: 2 },
        { productKey: 'aceite', qty: 1 },
      ],
      offers,
      stores,
    );
    expect(r.bestSingle!.total).toBe(50000 + 0); // a: 20000 + 30000 = 50000, envío gratis
    expect(r.best!.total).toBe(20000 + 5000 + 12000 + 5000); // 42000
    expect(r.best!.stores.sort()).toEqual(['a', 'b']);
    expect(r.savings).toBe(8000);
    expect(r.singles).toHaveLength(2);
  });

  it('no divide si el envío extra se come el ahorro', () => {
    const offers = [
      o('a', 'arroz', 10000),
      o('a', 'aceite', 14000),
      o('b', 'arroz', 9000),
      o('b', 'aceite', 15000),
    ];
    const r = optimizeBasket(
      [
        { productKey: 'arroz', qty: 1 },
        { productKey: 'aceite', qty: 1 },
      ],
      offers,
      stores,
    );
    expect(r.best!.stores).toHaveLength(1);
    expect(r.savings).toBe(0);
  });

  it('aprovecha el umbral de envío gratis moviendo productos', () => {
    // Greedy: arroz→b (44000), aceite→a (9000) = 44000+5000+9000+5000 = 63000.
    // Todo en b: 44000+9500 = 53500 ≥ 50000 → envío gratis.
    const offers = [
      o('a', 'arroz', 45000),
      o('a', 'aceite', 9000),
      o('b', 'arroz', 44000),
      o('b', 'aceite', 9500),
    ];
    const r = optimizeBasket(
      [
        { productKey: 'arroz', qty: 1 },
        { productKey: 'aceite', qty: 1 },
      ],
      offers,
      stores,
    );
    expect(r.best!.total).toBe(53500);
    expect(r.best!.stores).toEqual(['b']);
  });

  it('respeta el máximo de tiendas y reporta faltantes', () => {
    const offers = [o('a', 'arroz', 1000), o('b', 'aceite', 1000), o('c', 'cafe', 1000)];
    const lines = [
      { productKey: 'arroz', qty: 1 },
      { productKey: 'aceite', qty: 1 },
      { productKey: 'cafe', qty: 1 },
    ];
    const two = optimizeBasket(lines, offers, stores, { maxStores: 2 });
    expect(two.best!.missing).toHaveLength(1);
    expect(two.bestSingle).toBeNull();
    const three = optimizeBasket(lines, offers, stores, { maxStores: 3 });
    expect(three.best!.missing).toEqual([]);
    expect(three.best!.legs).toHaveLength(3);
    expect(three.best!.items).toBe(3);
  });

  it('lista vacía o tiendas no permitidas', () => {
    expect(optimizeBasket([], [], stores).best).toBeNull();
    const r = optimizeBasket(
      [{ productKey: 'arroz', qty: 1 }],
      [o('a', 'arroz', 1000), o('c', 'arroz', 2000)],
      stores,
      { allowed: ['c'] },
    );
    expect(r.best!.stores).toEqual(['c']);
  });
});

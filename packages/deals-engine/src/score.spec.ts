import { describe, expect, it } from 'vitest';
import { dealScore, gradeOf, landedPrice } from './score';
import { history, offer, store } from './testing';

describe('puntaje de oferta', () => {
  const real = offer({
    price: 7000,
    listPrice: 10000,
    history: history(90, (ago) => (ago < 3 ? 7000 : 10000)),
  });

  it('descuento real, más barato que otras tiendas, tienda confiable y envío gratis → excelente', () => {
    const s = dealScore(real, store('s1', { rating: 4.8 }), [8000, 9000]);
    expect(s.score).toBeGreaterThanOrEqual(85);
    expect(s.grade).toBe('excelente');
    expect(s.parts.map((p) => p.key)).toEqual([
      'ahorro',
      'tiendas',
      'historial',
      'confianza',
      'envio',
    ]);
    expect(s.parts.reduce((t, p) => t + p.max, 0)).toBe(100);
  });

  it('si otra tienda lo tiene mucho más barato, baja el puntaje', () => {
    const alone = dealScore(real, store('s1'), [6800]).score;
    const cheaper = dealScore(real, store('s1'), [5000]).score;
    expect(cheaper).toBeLessThan(alone);
  });

  it('el descuento inflado queda en máximo 30 aunque anuncie 50 %', () => {
    const inflated = offer({
      price: 10000,
      listPrice: 20000,
      history: history(90, (ago) => (ago < 3 ? 10000 : 10500)),
    });
    const s = dealScore(inflated, store('s1', { rating: 5 }), []);
    expect(s.score).toBeLessThanOrEqual(30);
  });

  it('envío caro y lento resta', () => {
    const fast = dealScore(real, store('s1'), []).score;
    const slow = dealScore(
      real,
      store('s1', { shipping: { cost: 15000, minDays: 8, maxDays: 15 } }),
      [],
    ).score;
    expect(slow).toBeLessThan(fast);
  });

  it('precio puesto en casa y grados', () => {
    expect(
      landedPrice(
        offer({ price: 50000 }),
        store('a', { shipping: { cost: 9000, freeFrom: 100000, minDays: 1, maxDays: 3 } }),
      ),
    ).toBe(59000);
    expect(
      landedPrice(
        offer({ price: 150000 }),
        store('a', { shipping: { cost: 9000, freeFrom: 100000, minDays: 1, maxDays: 3 } }),
      ),
    ).toBe(150000);
    expect([gradeOf(80), gradeOf(60), gradeOf(40), gradeOf(10)]).toEqual([
      'excelente',
      'buena',
      'regular',
      'floja',
    ]);
  });
});

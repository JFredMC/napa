import { describe, expect, it } from 'vitest';
import { checkWatches, suggestTarget } from './alerts';
import { offer } from './testing';

describe('alertas', () => {
  it('se dispara cuando el mejor precio llega al objetivo', () => {
    const offers = [
      offer({ id: 'a', storeId: 'a', price: 9000 }),
      offer({ id: 'b', storeId: 'b', price: 8500 }),
    ];
    const [s] = checkWatches(
      [{ productKey: 'p1', target: 8500, priceAtCreation: 9500, createdAt: '2026-10-01' }],
      offers,
    );
    expect(s!.triggered).toBe(true);
    expect(s!.best!.id).toBe('b');
    expect(s!.change).toBe(-1000);
    const [n] = checkWatches(
      [{ productKey: 'zzz', target: 1, priceAtCreation: 1, createdAt: '' }],
      offers,
    );
    expect(n!.best).toBeNull();
    expect(n!.triggered).toBe(false);
  });
  it('sugiere objetivo', () => {
    expect(suggestTarget(10000, 8730)).toBe(8700);
    expect(suggestTarget(10000)).toBe(9000);
    expect(suggestTarget(10000, 12000)).toBe(9000);
  });
});

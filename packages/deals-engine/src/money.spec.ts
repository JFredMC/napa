import { describe, expect, it } from 'vitest';
import { clamp, deltaPct, discountPct, median, savings } from './money';

describe('dinero', () => {
  it('descuento y ahorro', () => {
    expect(discountPct(7500, 10000)).toBe(25);
    expect(discountPct(10000, 10000)).toBe(0);
    expect(discountPct(12000, 10000)).toBe(0);
    expect(discountPct(100, 0)).toBe(0);
    expect(savings(7500, 10000)).toBe(2500);
    expect(savings(12000, 10000)).toBe(0);
  });
  it('delta con signo', () => {
    expect(deltaPct(9000, 10000)).toBe(10);
    expect(deltaPct(11000, 10000)).toBe(-10);
  });
  it('mediana y clamp', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBe(0);
    expect(clamp(2)).toBe(1);
    expect(clamp(-1)).toBe(0);
  });
});

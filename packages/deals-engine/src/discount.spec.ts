import { describe, expect, it } from 'vitest';
import { analyzeDiscount } from './discount';
import { history, offer } from './testing';

describe('detección de descuentos inflados', () => {
  it('real: baja frente al precio habitual', () => {
    const a = analyzeDiscount(
      offer({
        price: 8000,
        listPrice: 10000,
        history: history(90, (ago) => (ago < 3 ? 8000 : ago % 9 === 0 ? 9500 : 10000)),
      }),
    );
    expect(a.verdict).toBe('minimo');
    expect(a.declaredPct).toBe(20);
    expect(a.realPct).toBe(20);
    expect(a.reasons.join(' ')).toMatch(/más bajo de los últimos 90 días/);
  });

  it('real sin ser mínimo', () => {
    const a = analyzeDiscount(
      offer({
        price: 8500,
        listPrice: 10000,
        history: history(90, (ago) => (ago < 3 ? 8500 : ago === 50 ? 8000 : 10000)),
      }),
    );
    expect(a.verdict).toBe('real');
    expect(a.realPct).toBe(15);
  });

  it('inflado: el precio "antes" nunca se cobró', () => {
    const a = analyzeDiscount(
      offer({
        price: 10000,
        listPrice: 20000,
        history: history(90, (ago) => (ago < 3 ? 10000 : 11000)),
      }),
    );
    expect(a.verdict).toBe('inflado');
    expect(a.declaredPct).toBe(50);
    expect(a.realPct).toBeCloseTo(9.1, 1);
    expect(a.reasons[0]).toMatch(/no se cobró en los últimos 90 días/);
  });

  it('inflado: subieron el precio y luego "rebajaron" al mismo valor', () => {
    const a = analyzeDiscount(
      offer({
        price: 10000,
        listPrice: 12500,
        history: history(60, (ago) => (ago < 3 ? 10000 : ago < 12 ? 12500 : 9800)),
      }),
    );
    expect(a.verdict).toBe('inflado');
    expect(a.realPct).toBeLessThan(3);
    expect(a.reasons.join(' ')).toMatch(
      /más caro que su precio habitual|igual a su precio habitual/,
    );
  });

  it('dudoso o sin historial cuando no hay datos', () => {
    expect(analyzeDiscount(offer({ price: 3000, listPrice: 10000 })).verdict).toBe('dudoso');
    expect(analyzeDiscount(offer({ price: 9000, listPrice: 10000 })).verdict).toBe('sin-historial');
    expect(
      analyzeDiscount(offer({ price: 9000, listPrice: 10000, history: history(10, () => 9000) }))
        .verdict,
    ).toBe('sin-historial');
    expect(analyzeDiscount(offer()).verdict).toBe('sin-descuento');
  });

  it('sin descuento con historial estable', () => {
    const a = analyzeDiscount(offer({ history: history(60, () => 4000) }));
    expect(a.verdict).toBe('sin-descuento');
    expect(a.usualPrice).toBe(4000);
  });

  it('baja sin tachado también cuenta como real', () => {
    const a = analyzeDiscount(
      offer({
        price: 3400,
        listPrice: 3400,
        history: history(60, (ago) => (ago < 2 ? 3400 : 4000)),
      }),
    );
    expect(a.verdict).toBe('minimo');
    expect(a.declaredPct).toBe(0);
    expect(a.realPct).toBe(15);
  });
});

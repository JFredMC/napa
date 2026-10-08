import { cop, copShort, km, pct, shortDate, unitLabel } from './format';

describe('format', () => {
  it('formatea pesos colombianos', () => {
    expect(cop(4300)).toBe('$4.300');
    expect(cop(1899900)).toBe('$1.899.900');
    expect(cop(-2500)).toBe('−$2.500');
    expect(cop(null)).toBe('—');
  });

  it('abrevia montos grandes para los ejes', () => {
    expect(copShort(1_900_000)).toBe('$1,9 M');
    expect(copShort(350_000)).toBe('$350 mil');
    expect(copShort(4_300)).toBe('$4.300');
  });

  it('porcentajes, fechas, distancias y precio por unidad', () => {
    expect(pct(12.4)).toBe('12 %');
    expect(pct(undefined)).toBe('—');
    expect(shortDate('2026-10-07')).toBe('7 oct');
    expect(km(0.161)).toBe('161 m');
    expect(km(1.25)).toBe('1,3 km');
    expect(unitLabel({ value: 3350, per: 'kg' })).toBe('$3.350 / kg');
    expect(unitLabel(null)).toBe('');
  });
});

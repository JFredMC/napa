import { describe, expect, it } from 'vitest';
import { parseAmount, parseSize, unitPrice } from './units';

describe('parseAmount', () => {
  it('entiende miles con punto y decimales con coma o punto', () => {
    expect(parseAmount('1.000')).toBe(1000);
    expect(parseAmount('2,5')).toBe(2.5);
    expect(parseAmount('1.5')).toBe(1.5);
    expect(parseAmount('12.000.000')).toBe(12_000_000);
  });
});

describe('parseSize', () => {
  it.each([
    ['Arroz blanco 1 kg', { amount: 1000, unit: 'g' }],
    ['Atún en agua 160 g', { amount: 160, unit: 'g' }],
    ['Café molido 500gr', { amount: 500, unit: 'g' }],
    ['Aceite de girasol 2,5 L', { amount: 2500, unit: 'ml' }],
    ['Leche entera 6 x 1.100 ml', { amount: 6600, unit: 'ml' }],
    ['Gaseosa 330 ml x 6', { amount: 1980, unit: 'ml' }],
    ['Detergente líquido 3 Lt', { amount: 3000, unit: 'ml' }],
    ['Papel higiénico x 12 rollos', { amount: 12, unit: 'u' }],
    ['Pañales etapa 3 50 unidades', { amount: 50, unit: 'u' }],
    ['Huevos rojos AA x30', { amount: 30, unit: 'u' }],
    ['Panela 2 libras', { amount: 1000, unit: 'g' }],
    ['Paca agua 6×600 ml', { amount: 3600, unit: 'ml' }],
  ])('%s', (title, expected) => {
    expect(parseSize(title)).toEqual(expected);
  });

  it('devuelve null sin tamaño', () => {
    expect(parseSize('Audífonos inalámbricos X2')).toBeNull();
    expect(parseSize('Televisor 55 pulgadas 4K')).toBeNull();
  });
});

describe('unitPrice', () => {
  it('calcula por kg, litro y unidad', () => {
    expect(unitPrice(4200, { amount: 500, unit: 'g' })).toEqual({ value: 8400, per: 'kg' });
    expect(unitPrice(9900, { amount: 1980, unit: 'ml' })).toEqual({ value: 5000, per: 'L' });
    expect(unitPrice(18000, { amount: 12, unit: 'u' })).toEqual({ value: 1500, per: 'unidad' });
  });
  it('null sin tamaño o precio', () => {
    expect(unitPrice(1000, null)).toBeNull();
    expect(unitPrice(0, { amount: 1, unit: 'u' })).toBeNull();
  });
});

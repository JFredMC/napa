import { STAPLES, isGrocery, isStaple, stapleBySlug } from './staples';

describe('básicos /precio', () => {
  it('hay entre 20 y 30 básicos con slug único', () => {
    expect(STAPLES.length).toBeGreaterThanOrEqual(20);
    expect(STAPLES.length).toBeLessThanOrEqual(30);
    expect(new Set(STAPLES.map((s) => s.slug)).size).toBe(STAPLES.length);
  });
  it('el título debe empezar por el producto', () => {
    const arroz = stapleBySlug('arroz')!;
    expect(isStaple('Arroz Roa x1kg', arroz)).toBe(true);
    expect(isStaple('Atún en aceite con arroz', arroz)).toBe(false);
    expect(isStaple('Lenteja Olimpica 500 G', stapleBySlug('lentejas')!)).toBe(true);
    expect(isStaple('Papel Higiénico Nube x4', stapleBySlug('papel-higienico')!)).toBe(true);
    expect(isStaple('Papel aluminio x7m', stapleBySlug('papel-higienico')!)).toBe(false);
    expect(isStaple('Galleta Kelcat atún para gatos', stapleBySlug('galletas')!)).toBe(false);
  });
});

describe('isGrocery', () => {
  const o = (title: string, category: string, price = 5000) =>
    ({ title, category, price, listPrice: price }) as never;
  it('deja mercado y saca hogar, juguetes y electro', () => {
    expect(isGrocery(o('Arroz Roa x1kg', 'despensa'))).toBe(true);
    expect(isGrocery(o('Shampoo Sedal 650 ml', 'cuidado-personal'))).toBe(true);
    expect(isGrocery(o('Organizador De Huevos De Cocina', 'despensa'))).toBe(false);
    expect(isGrocery(o('Espumador de Leche Cuisinart', 'lacteos'))).toBe(false);
    expect(isGrocery(o('Sofa Inflable Con Reposapies', 'hogar'))).toBe(false);
    expect(isGrocery(o('Hervidor De Huevos Electrico', 'despensa'))).toBe(false);
  });
});

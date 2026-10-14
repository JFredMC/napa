import { STAPLES, isStaple, stapleBySlug } from './staples';

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

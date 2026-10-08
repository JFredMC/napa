import { describe, expect, it } from 'vitest';
import { haversineKm, matchBrand, overpassQuery } from './geo';

const rules = [
  { storeId: 'd1', patterns: ['D1', 'Tiendas D1'] },
  { storeId: 'ara', patterns: ['Ara', 'Tiendas Ara'] },
  { storeId: 'exito', patterns: ['Éxito', 'Exito Express'] },
];

describe('geo', () => {
  it('distancia Bogotá–Medellín ≈ 240 km', () => {
    const km = haversineKm({ lat: 4.711, lng: -74.0721 }, { lat: 6.2442, lng: -75.5812 });
    expect(km).toBeGreaterThan(230);
    expect(km).toBeLessThan(250);
    expect(haversineKm({ lat: 1, lng: 1 }, { lat: 1, lng: 1 })).toBe(0);
  });
  it('reconoce cadenas por etiquetas de OSM, palabra completa', () => {
    expect(matchBrand({ brand: 'D1' }, rules)).toBe('d1');
    expect(matchBrand({ name: 'Tiendas ARA Chapinero' }, rules)).toBe('ara');
    expect(matchBrand({ name: 'Éxito Express Calle 53' }, rules)).toBe('exito');
    expect(matchBrand({ name: 'Panadería Araucana' }, rules)).toBeNull();
    expect(matchBrand({}, rules)).toBeNull();
  });
  it('consulta Overpass acotada', () => {
    const q = overpassQuery({ lat: 4.65, lng: -74.06 }, 99999);
    expect(q).toContain('around:5000,4.65000,-74.06000');
    expect(q).toContain('supermarket|convenience');
  });
});

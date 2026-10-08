import fixture from '../../../e2e/fixtures/overpass-chapinero.json';
import { SAMPLE_CENTER, parseOverpass } from './location.store';

describe('parseOverpass', () => {
  const places = parseOverpass(fixture.elements, SAMPLE_CENTER);

  it('ordena por distancia y usa el centro de los polígonos', () => {
    expect(places).toHaveLength(fixture.elements.length);
    const d = places.map((p) => p.distanceKm);
    expect(d).toEqual([...d].sort((a, b) => a - b));
    expect(places.find((p) => p.id === 'way/528178891')?.lat).toBeCloseTo(4.6479, 3);
  });

  it('reconoce las cadenas que compara Ñapa, con o sin tilde', () => {
    const byName = (n: string) => places.find((p) => p.name === n)?.storeId;
    expect(byName('D1')).toBe('d1');
    expect(byName('Carulla')).toBe('carulla');
    expect(byName('Olimpica')).toBe('olimpica');
    expect(byName('SAO Chapinero')).toBe('olimpica');
    expect(byName('Éxito Express')).toBe('exito');
    expect(byName('Exito Expresss')).toBe('exito');
  });

  it('descarta elementos sin nombre o sin coordenadas y deja sin cadena a las tiendas desconocidas', () => {
    const out = parseOverpass(
      [
        { type: 'node', id: 1, lat: 4.65, lon: -74.06, tags: { shop: 'convenience' } },
        { type: 'way', id: 2, tags: { name: 'Sin centro', shop: 'supermarket' } },
        {
          type: 'node',
          id: 3,
          lat: 4.65,
          lon: -74.06,
          tags: {
            name: 'Tienda Doña Rosa',
            shop: 'convenience',
            'addr:street': 'Calle 60',
            'addr:housenumber': '9-12',
          },
        },
      ],
      SAMPLE_CENTER,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ storeId: null, address: 'Calle 60 # 9-12' });
  });
});

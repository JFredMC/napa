import { loadConfig } from './config';
import { RobotsService } from './robots.service';
import { SearchService } from './search.service';
import { fakeFetch } from '../test/fake-fetch';

const clock = () => new Date('2026-10-07T15:00:00Z');

function setup(env: NodeJS.ProcessEnv = {}) {
  const config = { ...loadConfig(env), upstreamIntervalMs: 0 };
  const fetch = fakeFetch();
  const robots = new RobotsService(config, fetch);
  return { fetch, service: new SearchService(config, fetch, clock, robots), robots };
}

describe('SearchService', () => {
  it('Jumbo y Olímpica en vivo; Éxito y Carulla bloqueadas por robots.txt; el resto simulado', async () => {
    const { service, fetch } = setup();
    const r = await service.search({ q: 'arroz', limit: 24 });
    const mode = Object.fromEntries(r.stores.map((s) => [s.storeId, s.mode]));
    expect(mode).toMatchObject({
      jumbo: 'live',
      olimpica: 'live',
      exito: 'blocked',
      carulla: 'blocked',
      d1: 'simulated',
      temu: 'simulated',
      mercadolibre: 'simulated',
    });
    // Nunca pidió la API de Éxito o Carulla (respectDisallow: /api/).
    expect(fetch.calls.filter((u) => u.includes('exito.com') || u.includes('carulla.com'))).toEqual(
      [],
    );
    // Olímpica prohíbe "&": se usa la ruta simple, sin paginación.
    expect(fetch.calls).toContain(
      'https://www.olimpica.com/api/catalog_system/pub/products/search?ft=arroz',
    );
    expect(fetch.calls).toContain(
      'https://www.jumbocolombia.com/api/catalog_system/pub/products/search?ft=arroz&_from=0&_to=23',
    );
    const live = r.offers.filter((o) => o.source === 'live');
    expect(new Set(live.map((o) => o.storeId))).toEqual(new Set(['jumbo', 'olimpica']));
    expect(live.every((o) => o.history?.length === 1)).toBe(true);
    // El mismo producto en Jumbo y Olímpica queda emparejado.
    const arroz = live.filter((o) => o.title.startsWith('Arroz'));
    expect(new Set(arroz.map((o) => o.productKey)).size).toBe(1);
    expect(
      r.offers.filter((o) => o.storeId === 'exito').every((o) => o.source === 'simulated'),
    ).toBe(true);
  });

  it('usa caché y un solo robots.txt por tienda', async () => {
    const { service, fetch } = setup();
    await service.search({ q: 'arroz', limit: 24 }, ['jumbo']);
    await service.search({ q: 'arroz', limit: 24 }, ['jumbo']);
    expect(fetch.calls.filter((u) => u.includes('/api/catalog_system'))).toHaveLength(1);
    expect(fetch.calls.filter((u) => u.endsWith('/robots.txt'))).toHaveLength(1);
  });

  it('si la tienda falla, marca bloqueada y usa el simulado', async () => {
    const { service, fetch } = setup();
    fetch.fail.add('www.jumbocolombia.com');
    const r = await service.search({ q: 'arroz', limit: 24 }, ['jumbo']);
    expect(r.stores[0]).toMatchObject({ storeId: 'jumbo', mode: 'blocked' });
    expect(r.offers.every((o) => o.source === 'simulated')).toBe(true);
  });

  it('LIVE_STORES vacío: todo simulado', async () => {
    const { service, fetch } = setup({ LIVE_STORES: '' });
    const r = await service.search({ q: 'arroz', limit: 24 });
    expect(r.stores.every((s) => s.mode === 'simulated')).toBe(true);
    expect(fetch.calls).toEqual([]);
  });

  it('estado de fuentes', async () => {
    const { service } = setup();
    const s = Object.fromEntries((await service.sources()).map((x) => [x.storeId, x.mode]));
    expect(s).toMatchObject({ jumbo: 'live', exito: 'blocked', shein: 'simulated' });
  });
});

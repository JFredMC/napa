import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { ConnectorError } from '../connector';
import { createVtexConnector, parseVtexProduct, vtexSearchPath } from './vtex';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/vtex-search.json', import.meta.url), 'utf8')) as unknown[];
const AT = '2026-10-07T13:00:00.000Z';

describe('adaptador VTEX', () => {
  it('arma la ruta de búsqueda acotada', () => {
    expect(vtexSearchPath({ q: 'atún agua', limit: 100 })).toBe('/api/catalog_system/pub/products/search?ft=at%C3%BAn+agua&_from=0&_to=49');
  });

  it('toma el vendedor disponible más barato, precio antes, tamaño, imagen y enlace', () => {
    const o = parseVtexProduct(fixture[0], 'jumbo', 'https://tienda.example', AT)!;
    expect(o).toMatchObject({
      id: 'jumbo-900001',
      storeId: 'jumbo',
      price: 3990,
      listPrice: 4590,
      size: { amount: 1000, unit: 'g' },
      category: 'despensa',
      source: 'live',
      seller: 'Tienda Ejemplo',
      stock: 50,
      url: 'https://tienda.example/arroz-blanco-la-cosecha-1000g-900001/p',
      image: 'https://tienda.vteximg.com.br/arquivos/ids/123456-300-300/arroz.jpg?v=1',
    });
  });

  it('usa la unidad de medida de VTEX si el título no trae tamaño y descarta imágenes inseguras', () => {
    const o = parseVtexProduct(fixture[1], 'olimpica', 'https://tienda.example', AT)!;
    expect(o.size).toEqual({ amount: 500, unit: 'g' });
    expect(o.listPrice).toBe(12900);
    expect(o.image).toBeUndefined();
    expect(o.category).toBe('lacteos');
    expect(o.url).toBe('https://tienda.example/queso-campesino-900002/p');
  });

  it('descarta agotados y productos sin id', () => {
    expect(parseVtexProduct(fixture[2], 'x', 'https://tienda.example', AT)).toBeNull();
    expect(parseVtexProduct(fixture[3], 'x', 'https://tienda.example', AT)).toBeNull();
  });

  it('busca con User-Agent propio y sin seguir redirecciones', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify(fixture), { status: 206 }));
    const c = createVtexConnector({ storeId: 'jumbo', origin: 'https://tienda.example', fetch, userAgent: 'NapaBot/0.1', now: () => new Date(AT) });
    const offers = await c.search({ q: 'arroz' });
    expect(offers).toHaveLength(2);
    expect(c.kind).toBe('live');
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://tienda.example/api/catalog_system/pub/products/search?ft=arroz&_from=0&_to=23');
    expect((init.headers as Record<string, string>)['user-agent']).toBe('NapaBot/0.1');
    expect(init.redirect).toBe('error');
    expect(await c.search({ q: 'arroz', category: 'lacteos' })).toHaveLength(1);
  });

  it('errores tipados', async () => {
    const make = (res: () => Promise<Response>) =>
      createVtexConnector({ storeId: 'jumbo', origin: 'https://tienda.example', fetch: res, userAgent: 'x' });
    await expect(make(async () => new Response('', { status: 403 })).search({ q: 'a' })).rejects.toMatchObject({ code: 'forbidden' });
    await expect(make(async () => new Response('', { status: 500 })).search({ q: 'a' })).rejects.toMatchObject({ code: 'http' });
    await expect(make(async () => new Response('no json', { status: 200 })).search({ q: 'a' })).rejects.toMatchObject({ code: 'parse' });
    await expect(make(async () => Promise.reject(new Error('boom'))).search({ q: 'a' })).rejects.toBeInstanceOf(ConnectorError);
  });
});

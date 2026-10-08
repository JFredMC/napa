import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { MercadoLibreAuth, createMercadoLibreConnector, parseMercadoLibreItem } from './mercadolibre';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/ml-search.json', import.meta.url), 'utf8')) as { results: unknown[] };
const AT = '2026-10-07T13:00:00.000Z';

describe('adaptador Mercado Libre', () => {
  it('normaliza resultados de /sites/MCO/search', () => {
    const o = parseMercadoLibreItem(fixture.results[0], AT)!;
    expect(o).toMatchObject({
      id: 'mercadolibre-MCO000000001',
      price: 299900,
      listPrice: 389900,
      brand: 'Calora',
      category: 'electrohogar',
      url: 'https://articulo.mercadolibre.com.co/MCO-000000001-freidora',
      image: 'https://http2.mlstatic.com/D_000-I.jpg',
      seller: 'VENDEDOR_EJEMPLO',
      source: 'live',
    });
    const cafe = parseMercadoLibreItem(fixture.results[1], AT)!;
    expect(cafe.listPrice).toBe(18500);
    expect(cafe.url).toBeUndefined();
    expect(cafe.size).toEqual({ amount: 500, unit: 'g' });
    expect(parseMercadoLibreItem(fixture.results[2], AT)).toBeNull();
  });

  it('sin credenciales no llama a la API', async () => {
    const fetch = vi.fn();
    const c = createMercadoLibreConnector({ auth: null, fetch, userAgent: 'x' });
    await expect(c.search({ q: 'freidora' })).rejects.toMatchObject({ code: 'no-credentials' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('busca con Bearer y marca 403 como bloqueado', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify(fixture)));
    const c = createMercadoLibreConnector({ auth: { accessToken: async () => 'TOKEN' }, fetch, userAgent: 'x' });
    expect(await c.search({ q: 'freidora' })).toHaveLength(2);
    const init = (fetch.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>)['authorization']).toBe('Bearer TOKEN');
    const denied = createMercadoLibreConnector({ auth: { accessToken: async () => 'T' }, fetch: async () => new Response('{}', { status: 403 }), userAgent: 'x' });
    await expect(denied.search({ q: 'a' })).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('renueva el token, lo reutiliza y guarda el refresh token rotado', async () => {
    let t = 0;
    const fetch = vi.fn(async () => new Response(JSON.stringify({ access_token: `A${++t}`, expires_in: 21600, refresh_token: `R${t}` })));
    let now = 0;
    const creds = { clientId: 'id', clientSecret: 's', refreshToken: 'R0' };
    const auth = new MercadoLibreAuth(creds, fetch, () => now);
    expect(await auth.accessToken()).toBe('A1');
    expect(await auth.accessToken()).toBe('A1');
    expect(creds.refreshToken).toBe('R1');
    now = 21600 * 1000;
    expect(await auth.accessToken()).toBe('A2');
    const body = (fetch.mock.calls[1] as unknown as [string, RequestInit])[1].body as string;
    expect(body).toContain('grant_type=refresh_token');
    expect(body).toContain('refresh_token=R1');
  });
});

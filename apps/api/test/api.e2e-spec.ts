import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp } from '../src/bootstrap';
import { loadConfig } from '../src/config';
import { fakeFetch } from './fake-fetch';

describe('API (e2e)', () => {
  let app: INestApplication;
  const fetchFn = fakeFetch();

  beforeAll(async () => {
    const config = {
      ...loadConfig({ CORS_ORIGINS: 'http://localhost:4200' }),
      upstreamIntervalMs: 0,
      clientRpm: 8,
    };
    app = await createApp({
      config,
      fetch: fetchFn,
      clock: () => new Date('2026-10-07T15:00:00Z'),
    });
    await app.init();
  });

  afterAll(() => app.close());

  it('GET /api/health', () =>
    request(app.getHttpServer()).get('/api/health').expect(200, { status: 'ok' }));

  it('GET /api/search mezcla fuentes reales y simuladas, cada oferta marcada', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/search?q=arroz&limit=10')
      .set('Origin', 'http://localhost:4200')
      .expect(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:4200');
    expect(res.body.offers.some((o: { source: string }) => o.source === 'live')).toBe(true);
    expect(
      res.body.offers.every(
        (o: { source: string }) => o.source === 'live' || o.source === 'simulated',
      ),
    ).toBe(true);
    expect(res.body.stores).toHaveLength(11);
  });

  it('valida parámetros', async () => {
    await request(app.getHttpServer()).get('/api/search?limit=500').expect(400);
    await request(app.getHttpServer()).get('/api/search?category=nada').expect(400);
    await request(app.getHttpServer())
      .get(`/api/search?q=${'a'.repeat(81)}`)
      .expect(400);
  });

  it('GET /api/sources', async () => {
    const res = await request(app.getHttpServer()).get('/api/sources').expect(200);
    const exito = res.body.find((s: { storeId: string }) => s.storeId === 'exito');
    expect(exito.mode).toBe('blocked');
    expect(exito.access).toMatchObject({ status: 429, botBlocked: true });
    expect(exito.reason).toContain('anti-bots');
    // La comprobación se guarda 12 h: una segunda consulta no vuelve a tocar la tienda.
    await request(app.getHttpServer()).get('/api/sources').expect(200);
    expect(fetchFn.calls.filter((u) => u.endsWith('/sitemap/sitemap.xml'))).toEqual([
      'https://www.exito.com/sitemap/sitemap.xml',
      'https://www.carulla.com/sitemap/sitemap.xml',
    ]);
  });

  it('limita peticiones por cliente (429)', async () => {
    let last = 200;
    for (let i = 0; i < 10; i += 1)
      last = (await request(app.getHttpServer()).get('/api/health')).status;
    expect(last).toBe(429);
  });
});

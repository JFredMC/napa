import { createHash } from 'node:crypto';
import request from 'supertest';
import { createApp } from '../src/bootstrap';
import { loadConfig } from '../src/config';
import { seal } from '../src/cuadre';
import { integritySignature } from '../src/wompi';
import { fakeFetch } from './fake-fetch';

const ENV = {
  WOMPI_INTEGRITY_SECRET: 'test_integrity_x',
  WOMPI_EVENTS_SECRET: 'test_events_y',
  CUADRE_FILES_GIST_ID: 'filesgist',
  CUADRE_FILES_KEY: 'files-key-z',
  ALERTS_GIST_ID: 'stategist',
  ALERTS_GITHUB_TOKEN: 'gh-token',
  RENDER_EXTERNAL_URL: 'https://napa-api.onrender.com',
  CORS_ORIGINS: 'https://cuadrelaboral.com,https://www.cuadrelaboral.com',
};
const XLSX = Buffer.from('PK-fake-liquidacion');

async function start() {
  const base = fakeFetch();
  const gist: Record<string, string> = {};
  const wompi: Record<string, unknown> = {};
  const fetchFn = Object.assign(
    async (input: string, init?: RequestInit) => {
      if (input === 'https://api.github.com/gists/filesgist')
        return Response.json({
          files: {
            'liquidacion.enc': { content: seal(XLSX, 'cuadre-files', ENV.CUADRE_FILES_KEY) },
          },
        });
      if (input === 'https://api.github.com/gists/stategist') {
        if (init?.method === 'PATCH') {
          const files = JSON.parse(String(init.body)).files as Record<string, { content: string }>;
          for (const [k, v] of Object.entries(files)) gist[k] = v.content;
          return Response.json({});
        }
        return Response.json({
          files: Object.fromEntries(Object.entries(gist).map(([k, v]) => [k, { content: v }])),
        });
      }
      if (input.startsWith('https://production.wompi.co/v1/transactions/')) {
        const id = input.split('/').pop()!;
        return wompi[id] ? Response.json({ data: wompi[id] }) : new Response('', { status: 404 });
      }
      return base(input, init);
    },
    { calls: base.calls, fail: base.fail },
  );
  const app = await createApp({
    config: { ...loadConfig(ENV), upstreamIntervalMs: 0, clientRpm: 1000 },
    fetch: fetchFn,
  });
  await app.init();
  return { app, http: app.getHttpServer(), gist, wompi };
}

function event(tx: Record<string, unknown>, secret = ENV.WOMPI_EVENTS_SECRET) {
  const timestamp = 1_760_000_000;
  const properties = ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'];
  const checksum = createHash('sha256')
    .update(`${tx['id']}${tx['status']}${tx['amount_in_cents']}${timestamp}${secret}`)
    .digest('hex')
    .toUpperCase();
  return {
    event: 'transaction.updated',
    data: { transaction: tx },
    signature: { properties, checksum },
    timestamp,
  };
}

describe('Plantillas de Cuadre (e2e)', () => {
  it('checkout con precio del servidor, CORS de cuadrelaboral.com y orden cifrada', async () => {
    const { app, http, gist } = await start();
    const r = await request(http)
      .post('/api/plantillas/checkout')
      .set('origin', 'https://www.cuadrelaboral.com')
      .send({ sku: 'nomina', amount: 1000, email: 'a@b.co' })
      .expect(200);
    expect(r.headers['access-control-allow-origin']).toBe('https://www.cuadrelaboral.com');
    expect(r.body.amountInCents).toBe(2_990_000);
    expect(r.body.reference).toMatch(/^CUA-NOMINA-/);
    expect(r.body.signature).toBe(
      integritySignature(r.body.reference, 2_990_000, 'COP', ENV.WOMPI_INTEGRITY_SECRET),
    );
    expect(r.body.redirectUrl).toBe('https://cuadrelaboral.com/plantillas/gracias');
    const stored = gist['cuadre-orders.enc']!;
    expect(stored).toBeTruthy();
    expect(stored).not.toContain('a@b.co');
    expect(JSON.stringify(r.body)).not.toContain(ENV.WOMPI_INTEGRITY_SECRET);
    await request(http).post('/api/plantillas/checkout').send({ sku: 'toString' }).expect(400);
    await request(http)
      .post('/api/plantillas/checkout')
      .send({ sku: 'combo', email: 'x' })
      .expect(400);
    await app.close();
  });

  it('evento válido marca pagada y entrega enlace firmado que descarga el archivo', async () => {
    const { app, http } = await start();
    const { body: c } = await request(http)
      .post('/api/plantillas/checkout')
      .send({ sku: 'liquidacion' });
    const pending = await request(http).get(`/api/plantillas/order/${c.reference}`).expect(200);
    expect(pending.body).toMatchObject({ status: 'PENDING', downloads: [] });

    const tx = {
      id: '123-abc',
      status: 'APPROVED',
      reference: c.reference,
      amount_in_cents: 1_490_000,
      currency: 'COP',
    };
    await request(http).post('/api/wompi/events').send(event(tx, 'wrong')).expect(403);
    // Monto distinto: no se marca pagada.
    await request(http)
      .post('/api/wompi/events')
      .send(event({ ...tx, amount_in_cents: 100_000 }))
      .expect(200);
    expect((await request(http).get(`/api/plantillas/order/${c.reference}`)).body.status).toBe(
      'PENDING',
    );

    await request(http).post('/api/wompi/events').send(event(tx)).expect(200);
    const paid = await request(http).get(`/api/plantillas/order/${c.reference}`).expect(200);
    expect(paid.body.status).toBe('PAID');
    expect(paid.body.downloads).toHaveLength(1);
    const url = new URL(paid.body.downloads[0].url);
    expect(url.origin).toBe('https://napa-api.onrender.com');
    const dl = await request(http)
      .get(url.pathname + url.search)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (d: Buffer) => chunks.push(d));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(dl.headers['content-disposition']).toContain('Cuadre-Liquidacion-2026.xlsx');
    expect(Buffer.compare(dl.body as Buffer, XLSX)).toBe(0);

    const tampered = url.search.replace('file=liquidacion', 'file=nomina');
    await request(http)
      .get(url.pathname + tampered)
      .expect(403);
    await app.close();
  });

  it('respaldo: /order?id= consulta la transacción en Wompi', async () => {
    const { app, http, wompi } = await start();
    const { body: c } = await request(http)
      .post('/api/plantillas/checkout')
      .send({ sku: 'presupuesto' });
    wompi['tx-9'] = {
      id: 'tx-9',
      status: 'APPROVED',
      reference: c.reference,
      amount_in_cents: 990_000,
      currency: 'COP',
    };
    const r = await request(http).get(`/api/plantillas/order/${c.reference}?id=tx-9`).expect(200);
    expect(r.body.status).toBe('PAID');
    await request(http).get('/api/plantillas/order/CUA-NOPE-0000000000').expect(404);
    await app.close();
  });
});

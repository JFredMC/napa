import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp } from '../src/bootstrap';
import { loadConfig } from '../src/config';
import { fakeFetch } from './fake-fetch';

const ADMIN = 'test-admin-token-0123456789abcdef';

async function start(env: Record<string, string>) {
  const base = fakeFetch();
  const sent: { url: string; body: Record<string, unknown> }[] = [];
  const fetchFn = Object.assign(
    async (input: string, init?: RequestInit) => {
      if (input.startsWith('https://api.telegram.org/')) {
        sent.push({ url: input, body: JSON.parse(String(init?.body)) });
        return new Response('{"ok":true,"result":{"message_id":42}}', { status: 200 });
      }
      return base(input, init);
    },
    { calls: base.calls, fail: base.fail },
  );
  const app: INestApplication = await createApp({
    config: { ...loadConfig(env), upstreamIntervalMs: 0, clientRpm: 100 },
    fetch: fetchFn,
    clock: () => new Date('2026-10-07T15:00:00Z'),
  });
  await app.init();
  return { app, sent };
}

describe('Canal de ofertas (e2e)', () => {
  it('GET /api/channel/post arma el texto para WhatsApp con precios en vivo y enlaces de afiliado', async () => {
    const { app } = await start({ NAPA_AFF_JUMBO: 'utm_source=napa' });
    const res = await request(app.getHttpServer()).get('/api/channel/post').expect(200);
    expect(res.body.format).toBe('whatsapp');
    expect(res.body.deals.length).toBeGreaterThan(0);
    expect(res.body.text).toContain('Ñapa · ofertas reales de hoy (7 de octubre)');
    expect(res.body.text).toContain('napaofertas.com/');
    const jumbo = res.body.deals.find((d: { store: string }) => d.store === 'Jumbo');
    if (jumbo) {
      expect(jumbo.href).toContain('utm_source=napa');
      expect(res.body.text).toContain('enlaces son de afiliado');
    }
    await app.close();
  });

  it('POST /api/channel/publish: 404 sin ADMIN_TOKEN, 401 con token malo, 503 sin Telegram', async () => {
    const off = await start({});
    await request(off.app.getHttpServer()).post('/api/channel/publish').expect(404);
    await off.app.close();
    const noTg = await start({ ADMIN_TOKEN: ADMIN });
    await request(noTg.app.getHttpServer())
      .post('/api/channel/publish')
      .set('Authorization', 'Bearer otro-token-equivocado-1234567890')
      .expect(401);
    await request(noTg.app.getHttpServer())
      .post('/api/channel/publish')
      .set('Authorization', `Bearer ${ADMIN}`)
      .expect(503);
    expect(noTg.sent).toHaveLength(0);
    await noTg.app.close();
  });

  it('publica en Telegram con HTML y sin vista previa', async () => {
    const { app, sent } = await start({
      ADMIN_TOKEN: ADMIN,
      TELEGRAM_BOT_TOKEN: '123456:fake-token',
      TELEGRAM_CHANNEL_ID: '@napa_ofertas',
    });
    const res = await request(app.getHttpServer())
      .post('/api/channel/publish')
      .set('Authorization', `Bearer ${ADMIN}`)
      .expect(200);
    expect(res.body).toMatchObject({ messageId: 42 });
    expect(res.body.sent).toBeGreaterThan(0);
    expect(JSON.stringify(res.body)).not.toContain('fake-token');
    expect(sent[0]!.url).toBe('https://api.telegram.org/bot123456:fake-token/sendMessage');
    expect(sent[0]!.body).toMatchObject({ chat_id: '@napa_ofertas', parse_mode: 'HTML' });
    expect(String(sent[0]!.body['text'])).toContain('<b>');
    await app.close();
  });
});

import request from 'supertest';
import { createApp } from '../src/bootstrap';
import { loadConfig } from '../src/config';
import { webhookSecret } from '../src/alerts/bot';
import { fakeFetch } from './fake-fetch';

const TOKEN = '123:fake-token';
const ADMIN = 'test-admin-token-0123456789abcdef';

async function start(env: Record<string, string>) {
  const base = fakeFetch();
  const sent: { method: string; body: Record<string, unknown> }[] = [];
  const fetchFn = Object.assign(
    async (input: string, init?: RequestInit) => {
      if (input.startsWith('https://api.telegram.org/')) {
        sent.push({ method: input.split('/').pop()!, body: JSON.parse(String(init?.body)) });
        return new Response('{"ok":true,"result":true}', { status: 200 });
      }
      return base(input, init);
    },
    { calls: base.calls, fail: base.fail },
  );
  const app = await createApp({
    config: { ...loadConfig(env), upstreamIntervalMs: 0, clientRpm: 100 },
    fetch: fetchFn,
  });
  await app.init();
  return { app, sent };
}

describe('Alertas de Telegram (e2e)', () => {
  it('health indica si Telegram está activo', async () => {
    const off = await start({});
    await request(off.app.getHttpServer())
      .get('/api/health')
      .expect(200, { status: 'ok', telegram: false, alerts: 'off' });
    await off.app.close();
  });

  it('registra el webhook al arrancar en Render y responde /alerta por webhook', async () => {
    const { app, sent } = await start({
      TELEGRAM_BOT_TOKEN: TOKEN,
      TELEGRAM_CHANNEL_ID: '@canal',
      RENDER_EXTERNAL_URL: 'https://api.example.com',
      ADMIN_TOKEN: ADMIN,
    });
    expect(sent.map((s) => s.method)).toEqual(['setWebhook', 'setMyCommands']);
    expect(sent[0]!.body['url']).toBe('https://api.example.com/api/telegram/webhook');
    const http = app.getHttpServer();
    await request(http)
      .get('/api/health')
      .expect(200, { status: 'ok', telegram: true, alerts: 'memory' });
    const update = {
      update_id: 1,
      message: { chat: { id: 9, type: 'private' }, text: '/alerta arroz' },
    };
    await request(http).post('/api/telegram/webhook').send(update).expect(403);
    await request(http)
      .post('/api/telegram/webhook')
      .set('X-Telegram-Bot-Api-Secret-Token', webhookSecret(TOKEN))
      .send(update)
      .expect(200);
    const reply = sent.at(-1)!;
    expect(reply.method).toBe('sendMessage');
    expect(reply.body['chat_id']).toBe('9');
    expect(String(reply.body['text'])).toContain('sigo «arroz»');
    await request(http).post('/api/alerts/check').expect(401);
    const res = await request(http)
      .post('/api/alerts/check')
      .set('Authorization', `Bearer ${ADMIN}`)
      .expect(200);
    expect(res.body).toEqual({ alerts: 1, notified: 0 });
    await app.close();
  });
});

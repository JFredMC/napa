import type { Offer } from '@napa/deals-engine';
import {
  checkAlerts,
  cheapest,
  decodeStartPayload,
  encodeStartPayload,
  handleUpdate,
  parseAlertArgs,
  type TgUpdate,
} from './bot';
import { decrypt, emptyState, encrypt } from './store';

const offer = (title: string, price: number, source: Offer['source'] = 'live'): Offer =>
  ({
    id: title,
    title,
    price,
    listPrice: price,
    source,
    url: 'https://x.co/p',
    storeId: 'jumbo',
  }) as Offer;
const msg = (text: string, type = 'private'): TgUpdate => ({
  update_id: 1,
  message: { chat: { id: 7, type }, text },
});
const NOW = new Date('2026-10-13T12:00:00Z');
const SITE = 'https://napaofertas.com/';

describe('bot de alertas', () => {
  it('deep link ida y vuelta, con límite de 64 caracteres', () => {
    const p = encodeStartPayload('Café Sello Rojo 500 g');
    expect(p.length).toBeLessThanOrEqual(64);
    expect(decodeStartPayload(p)).toBe('Café Sello Rojo 500 g');
    expect(encodeStartPayload('a'.repeat(200)).length).toBeLessThanOrEqual(64);
    expect(decodeStartPayload('otra')).toBeNull();
  });

  it('parsea búsqueda y precio máximo', () => {
    expect(parseAlertArgs('cafe sello rojo máx 15.000')).toEqual({
      q: 'cafe sello rojo',
      target: 15000,
    });
    expect(parseAlertArgs('arroz roa')).toEqual({ q: 'arroz roa', target: null });
    expect(parseAlertArgs('  ')).toBeNull();
  });

  it('cheapest exige todas las palabras y solo precios en vivo', () => {
    const offers = [
      offer('Arroz Roa 1kg', 5000),
      offer('Arroz Diana 1kg', 4000),
      offer('Arroz Roa 500g', 100, 'simulated'),
    ];
    expect(cheapest(offers, 'arroz roa')?.price).toBe(5000);
    expect(cheapest(offers, 'lentejas')).toBeNull();
  });

  it('/alerta, /mis_alertas y /borrar', async () => {
    const s = emptyState();
    const lookup = async () => offer('Arroz Roa 1kg', 5000);
    const [r1] = await handleUpdate(s, msg('/alerta arroz roa'), lookup, NOW, SITE);
    expect(r1!.text).toContain('sigo «arroz roa»');
    expect(r1!.text).toContain('$5.000');
    expect((await handleUpdate(s, msg('/alerta Arroz Roa'), lookup, NOW, SITE))[0]!.text).toContain(
      'Ya sigues',
    );
    expect((await handleUpdate(s, msg('/mis_alertas'), lookup, NOW, SITE))[0]!.text).toContain(
      '1. arroz roa',
    );
    expect((await handleUpdate(s, msg('/borrar 1'), lookup, NOW, SITE))[0]!.text).toContain(
      'Ya no sigo',
    );
    expect(s.users['7']!.alerts).toHaveLength(0);
    expect(await handleUpdate(s, msg('/alerta x', 'channel'), lookup, NOW, SITE)).toEqual([]);
  });

  it('/start con payload crea la alerta; sin payload muestra la ayuda', async () => {
    const s = emptyState();
    const lookup = async () => null;
    expect((await handleUpdate(s, msg('/start'), lookup, NOW, SITE))[0]!.text).toContain(
      '/mis_alertas',
    );
    await handleUpdate(s, msg(`/start ${encodeStartPayload('leche alqueria')}`), lookup, NOW, SITE);
    expect(s.users['7']!.alerts[0]!.q).toBe('leche alqueria');
  });

  it('avisa solo cuando baja (≥ 2 %) o cruza el objetivo', async () => {
    const s = emptyState();
    s.users['7'] = {
      nextId: 3,
      alerts: [
        { id: 1, q: 'arroz', target: null, last: 5000, createdAt: '' },
        { id: 2, q: 'cafe', target: 10000, last: 12000, createdAt: '' },
      ],
    };
    const prices: Record<string, number> = { arroz: 4990, cafe: 11000 };
    const lookup = async (q: string) => offer(q, prices[q]!);
    expect(await checkAlerts(s, lookup, NOW, SITE)).toHaveLength(0);
    prices['arroz'] = 4500;
    prices['cafe'] = 9900;
    const out = await checkAlerts(s, lookup, NOW, SITE);
    expect(out.map((r) => r.text.split('\n')[0])).toEqual([
      '📉 <b>Bajó de precio:</b> arroz',
      '📉 <b>Bajó de precio:</b> cafe',
    ]);
    expect(out[0]!.text).toContain('antes $4.990');
    expect(s.lastCheck).toBe(NOW.toISOString());
  });

  it('cifra el estado del gist', () => {
    const enc = encrypt('{"a":1}', 'secreto');
    expect(enc).not.toContain('"a"');
    expect(decrypt(enc, 'secreto')).toBe('{"a":1}');
    expect(() => decrypt(enc, 'otro')).toThrow();
  });
});

import { createHash } from 'node:crypto';
import type { Offer } from '@napa/deals-engine';
import type { Alert, AlertsState } from './store';

export const MAX_ALERTS = 10;
export const MAX_QUERY = 60;
/** Bajada mínima para avisar (evita ruido por $10 de diferencia). */
export const MIN_DROP = 0.02;

export interface TgUpdate {
  update_id: number;
  message?: { chat: { id: number; type: string }; text?: string; from?: { first_name?: string } };
}

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
export const cop = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;
export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Secreto del webhook derivado del token (Telegram lo manda en una cabecera). */
export function webhookSecret(botToken: string): string {
  return createHash('sha256').update(`napa-webhook:${botToken}`).digest('hex').slice(0, 48);
}

/** Deep link: t.me/NapaOfertasBot?start=q_<base64url de la búsqueda> (máx. 64 caracteres). */
export function decodeStartPayload(payload: string): string | null {
  if (!payload.startsWith('q_')) return null;
  try {
    const q = Buffer.from(payload.slice(2), 'base64url').toString('utf8').trim();
    return q && q.length <= MAX_QUERY ? q : null;
  } catch {
    return null;
  }
}
export function encodeStartPayload(q: string): string {
  let s = q.trim();
  while (Buffer.from(s, 'utf8').toString('base64url').length > 62) s = s.slice(0, -1);
  return `q_${Buffer.from(s.trim(), 'utf8').toString('base64url')}`;
}

/** "arroz roa 1kg máx 20000" → búsqueda + objetivo. */
export function parseAlertArgs(args: string): { q: string; target: number | null } | null {
  let target: number | null = null;
  const m = args.match(/\s+(?:max|máx|maximo|máximo|<)\.?\s*\$?\s*([\d.,]+)\s*$/i);
  let q = args;
  if (m) {
    target = Number(m[1]!.replace(/[.,]/g, '')) || null;
    q = args.slice(0, m.index);
  }
  q = q.replace(/\s+/g, ' ').trim();
  if (!q || q.length > MAX_QUERY) return null;
  return { q, target };
}

/** Oferta más barata en vivo cuyo título contiene todas las palabras de la búsqueda. */
export function cheapest(offers: Offer[], q: string): Offer | null {
  const words = norm(q)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1);
  const ok = offers.filter(
    (o) => o.source === 'live' && o.url && words.every((w) => norm(o.title).includes(w)),
  );
  return ok.sort((a, b) => a.price - b.price)[0] ?? null;
}

export const HELP = [
  '<b>🛒 Ñapa · alertas de precio</b>',
  '',
  'Te aviso cuando baje el precio de lo que sigas en Jumbo y Olímpica.',
  '',
  '/alerta <i>búsqueda</i> — seguir un producto. Ej.: <code>/alerta arroz roa 1kg</code>',
  '/alerta <i>búsqueda</i> máx <i>precio</i> — avisar solo bajo ese precio. Ej.: <code>/alerta cafe sello rojo máx 15000</code>',
  '/mis_alertas — ver lo que sigues',
  '/borrar <i>número</i> — dejar de seguir (o <code>/borrar todo</code>)',
  '',
  'Precios del momento; confírmalos en la tienda. Más ofertas en https://napaofertas.com/',
].join('\n');

export interface Reply {
  chatId: string;
  text: string;
}

export type Lookup = (q: string) => Promise<Offer | null>;

function describe(a: Alert, i: number): string {
  const t = a.target ? ` · máx ${cop(a.target)}` : '';
  const last = a.last ? ` · hoy ${cop(a.last)}` : '';
  return `${i + 1}. ${esc(a.q)}${t}${last}`;
}

/** Procesa un mensaje del bot. Muta `state` y devuelve las respuestas a enviar. */
export async function handleUpdate(
  state: AlertsState,
  u: TgUpdate,
  lookup: Lookup,
  now: Date,
  siteUrl: string,
): Promise<Reply[]> {
  const msg = u.message;
  if (!msg?.text || msg.chat.type !== 'private') return [];
  const chatId = String(msg.chat.id);
  const [rawCmd = '', ...rest] = msg.text.trim().split(/\s+/);
  const cmd = rawCmd.toLowerCase().replace(/@\w+$/, '');
  const args = rest.join(' ');
  const user = (state.users[chatId] ??= { alerts: [], nextId: 1 });
  const say = (text: string): Reply[] => [{ chatId, text }];

  const add = async (q: string, target: number | null): Promise<Reply[]> => {
    if (user.alerts.length >= MAX_ALERTS)
      return say(`Ya sigues ${MAX_ALERTS} productos. Borra alguno con /borrar.`);
    if (user.alerts.some((a) => norm(a.q) === norm(q)))
      return say(`Ya sigues «${esc(q)}». Mira /mis_alertas.`);
    const best = await lookup(q).catch(() => null);
    user.alerts.push({
      id: user.nextId++,
      q,
      target,
      last: best?.price ?? null,
      createdAt: now.toISOString(),
    });
    const goal = target ? ` cuando baje de <b>${cop(target)}</b>` : ' cuando baje de precio';
    const today = best
      ? `\nHoy lo más barato: <b>${cop(best.price)}</b> · ${esc(best.title)} (<a href="${esc(best.url ?? siteUrl)}">ver</a>).`
      : '\nAhora no encontré precios en vivo; revisaré en las próximas horas.';
    return say(`🔔 Listo, sigo «${esc(q)}» y te aviso${goal}.${today}`);
  };

  switch (cmd) {
    case '/start': {
      const q = args ? decodeStartPayload(args) : null;
      if (q) return add(q, null);
      return say(HELP);
    }
    case '/ayuda':
    case '/help':
      return say(HELP);
    case '/alerta': {
      const parsed = parseAlertArgs(args);
      if (!parsed)
        return say(
          `Escribe qué quieres seguir (máx. ${MAX_QUERY} letras). Ej.: <code>/alerta arroz roa 1kg</code>`,
        );
      return add(parsed.q, parsed.target);
    }
    case '/mis_alertas':
      if (!user.alerts.length)
        return say('No sigues nada todavía. Prueba <code>/alerta leche alqueria</code>.');
      return say(
        ['<b>Tus alertas</b>', ...user.alerts.map(describe), '', 'Borra con /borrar número.'].join(
          '\n',
        ),
      );
    case '/borrar': {
      if (/^todo|todas$/i.test(args)) {
        user.alerts = [];
        return say('Borré todas tus alertas.');
      }
      const n = Number(args);
      if (!Number.isInteger(n) || n < 1 || n > user.alerts.length)
        return say('Dime cuál borrar, por ejemplo <code>/borrar 1</code>. Mira /mis_alertas.');
      const [gone] = user.alerts.splice(n - 1, 1);
      return say(`Ya no sigo «${esc(gone!.q)}».`);
    }
    default:
      return say('No entendí. ' + HELP);
  }
}

/** Revisa todas las alertas (una búsqueda por texto distinto) y arma los avisos de bajada. */
export async function checkAlerts(
  state: AlertsState,
  lookup: Lookup,
  now: Date,
  siteUrl: string,
): Promise<Reply[]> {
  const memo = new Map<string, Promise<Offer | null>>();
  const out: Reply[] = [];
  for (const [chatId, user] of Object.entries(state.users)) {
    for (const a of user.alerts) {
      const key = norm(a.q);
      if (!memo.has(key))
        memo.set(
          key,
          lookup(a.q).catch(() => null),
        );
      const best = await memo.get(key)!;
      if (!best) continue;
      const prev = a.last;
      const dropped = prev !== null && best.price <= prev * (1 - MIN_DROP);
      const hit = a.target !== null && best.price <= a.target && (prev === null || prev > a.target);
      if ((dropped && (a.target === null || best.price <= a.target)) || hit) {
        const was = prev ? ` (antes ${cop(prev)})` : '';
        out.push({
          chatId,
          text: [
            `📉 <b>Bajó de precio:</b> ${esc(a.q)}`,
            `${esc(best.title)}: <b>${cop(best.price)}</b>${was}`,
            `<a href="${esc(best.url ?? siteUrl)}">Ver en la tienda</a> · <a href="${esc(`${siteUrl}?q=${encodeURIComponent(a.q)}`)}">Comparar en Ñapa</a>`,
          ].join('\n'),
        });
      }
      a.last = best.price;
    }
  }
  state.lastCheck = now.toISOString();
  return out;
}

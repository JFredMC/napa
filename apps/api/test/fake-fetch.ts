import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const VTEX_FIXTURE = readFileSync(join(__dirname, 'fixtures/vtex-search.json'), 'utf8');

/** robots.txt con la forma real de cada tienda (oct. 2026). */
const EXITO =
  'User-agent: *\nAllow: /\n\nUser-agent: Applebot-Extended\nAllow: /\n# APIs\nDisallow: /api/\n';
export const ROBOTS: Record<string, string> = {
  'www.exito.com': EXITO,
  'www.carulla.com': EXITO,
  'www.jumbocolombia.com': 'User-agent: *\nDisallow: /busca*\nDisallow: /checkout/\n',
  'www.olimpica.com':
    'User-agent: *\nDisallow: /secret\nUser-agent: *\nDisallow: /*&\nDisallow: /*%\n',
};

export interface FakeFetch {
  (input: string, init?: RequestInit): Promise<Response>;
  calls: string[];
  fail: Set<string>;
}

/** Simula las tiendas VTEX sin red: robots.txt y búsqueda de catálogo. */
export function fakeFetch(): FakeFetch {
  const fn = (async (input: string) => {
    fn.calls.push(input);
    const url = new URL(input);
    if (fn.fail.has(url.host)) return new Response('Too Many Requests', { status: 429 });
    if (url.pathname === '/robots.txt')
      return new Response(ROBOTS[url.host] ?? '', { status: ROBOTS[url.host] ? 200 : 404 });
    if (url.pathname.startsWith('/api/catalog_system/pub/products/search'))
      return new Response(VTEX_FIXTURE, { status: 206 });
    return new Response('not found', { status: 404 });
  }) as FakeFetch;
  fn.calls = [];
  fn.fail = new Set();
  return fn;
}

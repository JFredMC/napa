import { matchesQuery, parseSize, type Offer, type Size } from '@napa/deals-engine';
import {
  ConnectorError,
  type FetchLike,
  type SearchQuery,
  type StoreConnector,
} from '../connector';
import { mapCategory } from './categories';

/**
 * Adaptador REAL para tiendas sobre VTEX (catálogo público `/api/catalog_system/pub`).
 * Solo corre en el backend: el navegador no puede llamarlo por CORS y además así se respetan
 * robots.txt, caché y límite de ritmo en un único lugar.
 */
export interface VtexOptions {
  storeId: string;
  origin: string;
  fetch: FetchLike;
  userAgent: string;
  timeoutMs?: number;
  now?: () => Date;
  /**
   * Elige la primera ruta permitida (robots.txt). Sin esta función se usa la primera.
   * Si devuelve null, la tienda no permite la consulta y no se hace ninguna petición.
   */
  choosePath?: (candidates: string[]) => Promise<string | null>;
}

/** Palabras de búsqueda sin tildes ni símbolos (VTEX rechaza "+" y algunas tiendas prohíben "%"). */
export function vtexWords(q: string): string[] {
  const words = q
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6);
  return words.length ? words : ['oferta'];
}

/**
 * Rutas candidatas (sin origen), de la más completa a la más simple, para revisarlas contra
 * robots.txt antes de pedirlas: con paginación, sin "&" y, si hay varias palabras, solo la
 * más larga sin "%" (luego se filtra localmente por todas las palabras).
 */
export function vtexSearchPaths(query: SearchQuery): string[] {
  const to = Math.min(Math.max((query.limit ?? 24) - 1, 0), 49);
  const words = vtexWords(query.q);
  const base = `/api/catalog_system/pub/products/search?ft=${words.join('%20')}`;
  const paths = [`${base}&_from=0&_to=${to}`, base];
  if (words.length > 1) {
    const longest = [...words].sort((a, b) => b.length - a.length)[0];
    paths.push(`/api/catalog_system/pub/products/search?ft=${longest}`);
  }
  return paths;
}

type Json = Record<string, unknown>;
const obj = (v: unknown): Json | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null;
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string =>
  typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '';

function vtexImage(url: string): string | undefined {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' || !/(\.vteximg\.com\.br|\.vtexassets\.com)$/.test(u.hostname))
      return undefined;
    u.pathname = u.pathname.replace(/\/ids\/(\d+)(-\d+-\d+)?\//, '/ids/$1-300-300/');
    return u.toString();
  } catch {
    return undefined;
  }
}

function sizeFromItem(item: Json, title: string): Size | undefined {
  const fromTitle = parseSize(title);
  if (fromTitle) return fromTitle;
  const unit = str(item['measurementUnit']).toLowerCase();
  const mult = Number(item['unitMultiplier']);
  if (!(mult > 0)) return undefined;
  if (unit === 'kg') return { amount: mult * 1000, unit: 'g' };
  if (unit === 'g') return { amount: mult, unit: 'g' };
  if (unit === 'l' || unit === 'lt') return { amount: mult * 1000, unit: 'ml' };
  if (unit === 'ml') return { amount: mult, unit: 'ml' };
  return undefined;
}

/** Convierte un producto del catálogo VTEX en una oferta de Ñapa (el vendedor más barato disponible). */
export function parseVtexProduct(
  raw: unknown,
  storeId: string,
  origin: string,
  observedAt: string,
): Offer | null {
  const product = obj(raw);
  if (!product) return null;
  const productId = str(product['productId']);
  const title = str(product['productName']).replace(/\s+/g, ' ').trim();
  if (!productId || !title) return null;

  let best: { price: number; list: number; stock: number; seller: string; item: Json } | null =
    null;
  let image: string | undefined;
  for (const it of arr(product['items'])) {
    const item = obj(it);
    if (!item) continue;
    const firstImage = obj(arr(item['images'])[0]);
    image ??= firstImage ? vtexImage(str(firstImage['imageUrl'])) : undefined;
    for (const s of arr(item['sellers'])) {
      const seller = obj(s);
      const co = obj(seller?.['commertialOffer']);
      if (!seller || !co || co['IsAvailable'] === false) continue;
      const price = Math.round(Number(co['Price']));
      if (!(price > 0)) continue;
      const list = Math.max(
        price,
        Math.round(Number(co['ListPrice']) || price),
        Math.round(Number(co['PriceWithoutDiscount']) || price),
      );
      if (!best || price < best.price) {
        best = {
          price,
          list,
          stock: Math.max(0, Math.round(Number(co['AvailableQuantity']) || 0)),
          seller: str(seller['sellerName']),
          item,
        };
      }
    }
  }
  if (!best) return null;

  let url: string | undefined;
  try {
    const link = new URL(str(product['link']) || `/${str(product['linkText'])}/p`, origin);
    if (link.origin === new URL(origin).origin) url = link.toString();
  } catch {
    url = undefined;
  }
  const size = sizeFromItem(best.item, title);
  return {
    id: `${storeId}-${productId}`,
    productKey: `${storeId}-${productId}`,
    storeId,
    title: title.slice(0, 160),
    brand: str(product['brand']).slice(0, 60),
    category: mapCategory(arr(product['categories']).map(str), title),
    price: best.price,
    listPrice: best.list,
    ...(size ? { size } : {}),
    ...(url ? { url } : {}),
    ...(image ? { image } : {}),
    source: 'live',
    observedAt,
    seller: best.seller.slice(0, 80),
    stock: best.stock,
  };
}

export function createVtexConnector(opts: VtexOptions): StoreConnector {
  const now = opts.now ?? (() => new Date());
  return {
    storeId: opts.storeId,
    kind: 'live',
    async search(query, signal) {
      const candidates = vtexSearchPaths(query);
      const path = opts.choosePath ? await opts.choosePath(candidates) : candidates[0];
      if (!path)
        throw new ConnectorError(
          opts.storeId,
          'robots',
          'Su robots.txt no permite consultar el catálogo',
        );
      const url = `${opts.origin}${path}`;
      const timeout = AbortSignal.timeout(opts.timeoutMs ?? 8000);
      let res: Response;
      try {
        res = await opts.fetch(url, {
          headers: { accept: 'application/json', 'user-agent': opts.userAgent },
          signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
          redirect: 'error',
        });
      } catch (e) {
        throw new ConnectorError(
          opts.storeId,
          'timeout',
          `Sin respuesta de ${opts.origin}: ${(e as Error).message}`,
        );
      }
      // VTEX responde 206 (Partial Content) en búsquedas paginadas.
      if (res.status === 403)
        throw new ConnectorError(
          opts.storeId,
          'forbidden',
          `${opts.origin} rechazó la consulta (403)`,
        );
      if (!res.ok)
        throw new ConnectorError(opts.storeId, 'http', `${opts.origin} respondió ${res.status}`);
      let data: unknown;
      try {
        data = await res.json();
      } catch {
        throw new ConnectorError(opts.storeId, 'parse', `Respuesta no válida de ${opts.origin}`);
      }
      const observedAt = now().toISOString();
      // Con la ruta de una sola palabra, se exige localmente que estén todas las palabras.
      const narrowed = path === candidates[2];
      const offers = arr(data)
        .map((p) => parseVtexProduct(p, opts.storeId, opts.origin, observedAt))
        .filter((o): o is Offer => !!o)
        .filter((o) => !narrowed || matchesQuery(`${o.title} ${o.brand}`, query.q));
      return query.category ? offers.filter((o) => o.category === query.category) : offers;
    },
  };
}

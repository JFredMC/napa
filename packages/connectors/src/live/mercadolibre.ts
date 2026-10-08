import { parseSize, type Offer } from '@napa/deals-engine';
import { ConnectorError, type FetchLike, type StoreConnector } from '../connector';
import { mapCategory } from './categories';

/**
 * Adaptador REAL para la API oficial de Mercado Libre (sitio MCO, Colombia).
 *
 * Estado de la API (oct. 2026): sin token todo responde 403, y la búsqueda pública
 * `/sites/MCO/search` exige un access token OAuth de una aplicación registrada en
 * developers.mercadolibre.com.co (flujo authorization_code + refresh_token; no hay
 * client_credentials). Aun con token, Mercado Libre puede restringir la búsqueda por app;
 * si responde 403 el backend marca la tienda como bloqueada y usa la simulada.
 */
export const ML_API = 'https://api.mercadolibre.com';

export interface MercadoLibreCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

/** Renueva el access token con el refresh token y lo guarda en memoria hasta que venza. */
export class MercadoLibreAuth {
  private token: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly creds: MercadoLibreCredentials,
    private readonly fetchFn: FetchLike,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt - 60_000 > this.now()) return this.token.value;
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.creds.clientId,
      client_secret: this.creds.clientSecret,
      refresh_token: this.creds.refreshToken,
    });
    const res = await this.fetchFn(`${ML_API}/oauth/token`, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) throw new ConnectorError('mercadolibre', 'no-credentials', `No se pudo renovar el token (${res.status})`);
    const data = (await res.json()) as { access_token?: string; expires_in?: number; refresh_token?: string };
    if (!data.access_token) throw new ConnectorError('mercadolibre', 'no-credentials', 'Respuesta sin access_token');
    // Mercado Libre rota el refresh token en cada renovación.
    if (data.refresh_token) this.creds.refreshToken = data.refresh_token;
    this.token = { value: data.access_token, expiresAt: this.now() + (data.expires_in ?? 21_600) * 1000 };
    return this.token.value;
  }
}

type Json = Record<string, unknown>;
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null);
const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');

/** Convierte un resultado de `/sites/MCO/search` en una oferta de Ñapa. */
export function parseMercadoLibreItem(raw: unknown, observedAt: string): Offer | null {
  const item = obj(raw);
  if (!item) return null;
  const id = str(item['id']);
  const title = str(item['title']).trim();
  const price = Math.round(Number(item['price']));
  if (!id || !title || !(price > 0) || str(item['currency_id'] || 'COP') !== 'COP') return null;
  const original = Math.round(Number(item['original_price']) || 0);
  const attrs = Array.isArray(item['attributes']) ? item['attributes'] : [];
  const brand = str(obj(attrs.find((a) => obj(a)?.['id'] === 'BRAND'))?.['value_name']);
  const seller = obj(item['seller']);
  let url: string | undefined;
  try {
    const u = new URL(str(item['permalink']));
    if (u.protocol === 'https:' && u.hostname.endsWith('mercadolibre.com.co')) url = u.toString();
  } catch {
    url = undefined;
  }
  const thumb = str(item['thumbnail']).replace(/^http:/, 'https:');
  const size = parseSize(title);
  return {
    id: `mercadolibre-${id}`,
    productKey: `mercadolibre-${id}`,
    storeId: 'mercadolibre',
    title: title.slice(0, 160),
    brand: brand.slice(0, 60),
    category: mapCategory([str(item['domain_id']).replace(/^MCO-/, '').replace(/_/g, ' ')], title),
    price,
    listPrice: Math.max(price, original),
    ...(size ? { size } : {}),
    ...(url ? { url } : {}),
    ...(thumb.startsWith('https://') ? { image: thumb } : {}),
    source: 'live',
    observedAt,
    seller: str(seller?.['nickname']).slice(0, 80),
    stock: Math.max(0, Math.round(Number(item['available_quantity']) || 0)),
  };
}

export interface MercadoLibreOptions {
  auth: { accessToken(): Promise<string> } | null;
  fetch: FetchLike;
  userAgent: string;
  timeoutMs?: number;
  now?: () => Date;
}

export function createMercadoLibreConnector(opts: MercadoLibreOptions): StoreConnector {
  const now = opts.now ?? (() => new Date());
  return {
    storeId: 'mercadolibre',
    kind: 'live',
    async search(query, signal) {
      if (!opts.auth) throw new ConnectorError('mercadolibre', 'no-credentials', 'Falta configurar las credenciales OAuth de Mercado Libre');
      const token = await opts.auth.accessToken();
      const params = new URLSearchParams({ q: query.q.trim() || 'oferta', limit: String(Math.min(query.limit ?? 24, 50)) });
      const timeout = AbortSignal.timeout(opts.timeoutMs ?? 8000);
      let res: Response;
      try {
        res = await opts.fetch(`${ML_API}/sites/MCO/search?${params.toString()}`, {
          headers: { accept: 'application/json', authorization: `Bearer ${token}`, 'user-agent': opts.userAgent },
          signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        });
      } catch (e) {
        throw new ConnectorError('mercadolibre', 'timeout', `Sin respuesta de la API: ${(e as Error).message}`);
      }
      if (res.status === 401 || res.status === 403) {
        throw new ConnectorError('mercadolibre', 'forbidden', `La API de Mercado Libre rechazó la búsqueda (${res.status})`);
      }
      if (!res.ok) throw new ConnectorError('mercadolibre', 'http', `La API de Mercado Libre respondió ${res.status}`);
      const data = obj(await res.json());
      const observedAt = now().toISOString();
      const results = Array.isArray(data?.['results']) ? data['results'] : [];
      const offers = results.map((r) => parseMercadoLibreItem(r, observedAt)).filter((o): o is Offer => !!o);
      return query.category ? offers.filter((o) => o.category === query.category) : offers;
    },
  };
}

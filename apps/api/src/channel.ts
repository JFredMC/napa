import {
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Injectable,
  NotFoundException,
  Post,
  Query,
  ServiceUnavailableException,
  UnauthorizedException,
  BadGatewayException,
} from '@nestjs/common';
import { STORES, withAffiliate } from '@napa/connectors';
import {
  bestPerProduct,
  filterOffers,
  scoreOffers,
  sortOffers,
  type Offer,
  type ScoredOffer,
} from '@napa/deals-engine';
import { sameSecret } from './clicks';
import { APP_CONFIG, CLOCK, FETCH, type AppConfig } from './config';
import { SearchService } from './search.service';
import type { FetchLike } from '@napa/connectors';

/** Búsquedas básicas de mercado para armar el post del día (solo tiendas en vivo). */
export const CHANNEL_TERMS = [
  'arroz',
  'aceite',
  'leche',
  'cafe',
  'huevos',
  'atun',
  'detergente',
  'panales',
  'azucar',
  'pasta',
  'frijol',
  'jabon',
  'queso',
];
const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
/** Palabras que delatan que no es mercado aunque la tienda lo ponga en una categoría de mercado. */
const NOT_GROCERY =
  /\b(extractor|organizador|camion|juguete|cuna|olla|hervidor|cafetera|sofa|termo|vaso|toalla|cobija|silla|lampara|sarten|licuadora)\b/;

/** El producto ES el término: el título empieza por él o lo nombra al inicio ("Lomo de atún"). */
export function matchesTerm(title: string, term: string): boolean {
  const t = norm(title);
  if (NOT_GROCERY.test(t)) return false;
  const words = t.split(/[^a-z0-9]+/).filter(Boolean);
  const stem = norm(term);
  return words.slice(0, 4).some((w) => w === stem || w === `${stem}s` || w === `${stem}es`);
}
const LIVE_STORES = ['jumbo', 'olimpica'];
/** Solo mercado: "huevos" también trae hervidores y "café" sofás color café. */
const GROCERY = new Set([
  'despensa',
  'lacteos',
  'bebidas',
  'aseo-hogar',
  'cuidado-personal',
  'bebe',
]);

export interface ChannelDeal {
  title: string;
  store: string;
  price: number;
  listPrice: number;
  realPct: number | null;
  href: string;
  affiliate: boolean;
  /** Búsqueda en napaofertas.com para comparar el producto entre tiendas. */
  napaUrl: string;
}

export type PostFormat = 'whatsapp' | 'telegram';

const cop = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Formatea el post. WhatsApp: texto plano con *negritas*; Telegram: HTML de la Bot API. */
export function formatPost(
  deals: ChannelDeal[],
  format: PostFormat,
  siteUrl: string,
  date: string,
  temu: { url: string; code: string | null } | null = null,
): string {
  const tg = format === 'telegram';
  const bold = (s: string) => (tg ? `<b>${esc(s)}</b>` : `*${s}*`);
  const lines = [bold(`🛒 Ñapa · ofertas reales de hoy (${date})`), ''];
  deals.forEach((d, i) => {
    const off = d.realPct && d.realPct >= 1 ? ` (−${Math.round(d.realPct)} % real)` : '';
    const name = tg ? esc(d.title) : d.title;
    lines.push(`${i + 1}. ${name}`);
    lines.push(`   ${bold(cop(d.price))}${off} en ${tg ? esc(d.store) : d.store}`);
    lines.push(
      tg
        ? `   <a href="${esc(d.href)}">Ver en la tienda</a> · <a href="${esc(d.napaUrl)}">Comparar en Ñapa</a>`
        : `   ${d.href}\n   Comparar: ${d.napaUrl}`,
    );
    lines.push('');
  });
  if (temu) {
    const code = temu.code ? ` · Código: ${tg ? `<b>${esc(temu.code)}</b>` : temu.code}` : '';
    lines.push(
      tg
        ? `🛍️ <a href="${esc(temu.url)}">Ofertas en Temu</a>${code} (afiliado)`
        : `🛍️ Ofertas en Temu: ${temu.url}${code} (afiliado)`,
      '',
    );
  }
  if (deals.some((d) => d.affiliate) || temu)
    lines.push(
      'Algunos enlaces son de afiliado: si compras, Ñapa puede recibir una comisión sin costo para ti.',
    );
  lines.push(`Precios del momento; confírmalos en la tienda. Más en ${siteUrl}`);
  return lines.join('\n');
}

/**
 * Precio por kilo o litro imposible para mercado (> $150.000): suele ser un producto que la
 * tienda vende al peso con el precio por kilo mal cargado ("Queso x200g" a $97.000).
 */
export function absurdUnitPrice(o: Pick<Offer, 'price' | 'size'>): boolean {
  const size = o.size;
  if (!size || !size.amount || !['g', 'ml'].includes(size.unit)) return false;
  return (o.price / size.amount) * 1000 > 150_000;
}

/** Las 3 primeras palabras del título: búsqueda corta que sí encuentra el producto. */
export function searchTerms(title: string): string {
  return title.split(/\s+/).slice(0, 3).join(' ');
}

@Injectable()
export class ChannelService {
  constructor(
    private readonly search: SearchService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(FETCH) private readonly fetch: FetchLike,
    @Inject(CLOCK) private readonly clock: () => Date,
  ) {}

  /** Top N: solo precios en vivo, sin descuentos inflados, uno por producto, por puntaje. */
  async topDeals(n = this.config.channelTopN): Promise<ChannelDeal[]> {
    const offers = new Map<string, Offer>();
    const termOf = new Map<string, string>();
    for (const q of CHANNEL_TERMS) {
      const r = await this.search.search({ q, limit: 24 }, LIVE_STORES);
      for (const o of r.offers)
        if (o.source === 'live' && o.url && matchesTerm(o.title, q) && !absurdUnitPrice(o)) {
          offers.set(o.id, o);
          termOf.set(o.id, q);
        }
    }
    const scored = scoreOffers([...offers.values()], STORES);
    const honest = filterOffers(scored, { onlyHonest: true }).filter((s) =>
      GROCERY.has(s.offer.category),
    );
    // Primero las rebajas reales (según historial), luego el resto por puntaje.
    const ranked = sortOffers(bestPerProduct(honest), 'score');
    const discounted = ranked.filter((s) => (s.analysis.realPct ?? 0) >= 5);
    // Variedad: una oferta por término (arroz, leche…) y luego se completa si faltan.
    const ordered = [...discounted, ...ranked.filter((s) => !discounted.includes(s))];
    const seen = new Set<string>();
    const varied = ordered.filter((s) => {
      const t = termOf.get(s.offer.id) ?? s.offer.id;
      if (seen.has(t)) return false;
      seen.add(t);
      return true;
    });
    return [...varied, ...ordered.filter((s) => !varied.includes(s))]
      .slice(0, n)
      .map((s: ScoredOffer) => {
        const link = withAffiliate(s.offer.url ?? '', this.config.affiliates[s.offer.storeId]);
        return {
          title: s.offer.title,
          store: STORES[s.offer.storeId]?.name ?? s.offer.storeId,
          price: s.offer.price,
          listPrice: s.offer.listPrice,
          realPct: s.analysis.realPct ?? null,
          href: link.href,
          affiliate: link.affiliate,
          napaUrl: `${this.config.siteUrl}?q=${encodeURIComponent(searchTerms(s.offer.title))}`,
        };
      });
  }

  today(): string {
    return this.clock().toLocaleDateString('es-CO', {
      timeZone: 'America/Bogota',
      day: 'numeric',
      month: 'long',
    });
  }

  async post(format: PostFormat): Promise<{ text: string; deals: ChannelDeal[] }> {
    const deals = await this.topDeals();
    return {
      text: formatPost(deals, format, this.config.siteUrl, this.today(), this.config.temu),
      deals,
    };
  }

  /** Publica en el canal de Telegram (el bot debe ser administrador del canal). */
  async publishTelegram(): Promise<{ sent: number; messageId: number | null }> {
    const tg = this.config.telegram;
    if (!tg) throw new ServiceUnavailableException('Telegram no está configurado');
    const { text, deals } = await this.post('telegram');
    if (!deals.length) return { sent: 0, messageId: null };
    const res = await this.fetch(`https://api.telegram.org/bot${tg.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: tg.channelId,
        text,
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      description?: string;
      result?: { message_id?: number };
    };
    // Nunca se devuelve el token: solo la descripción de error de Telegram.
    if (!res.ok || !body.ok)
      throw new BadGatewayException(`Telegram: ${body.description ?? res.status}`);
    return { sent: deals.length, messageId: body.result?.message_id ?? null };
  }
}

@Controller('channel')
export class ChannelController {
  constructor(
    private readonly channel: ChannelService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** GET /api/channel/post?format=whatsapp|telegram: texto listo para copiar y pegar. */
  @Get('post')
  async post(
    @Query('format') format?: string,
  ): Promise<{ format: PostFormat; text: string; deals: ChannelDeal[] }> {
    const f: PostFormat = format === 'telegram' ? 'telegram' : 'whatsapp';
    return { format: f, ...(await this.channel.post(f)) };
  }

  /** POST /api/channel/publish con `Authorization: Bearer <ADMIN_TOKEN>` (lo llama el cron). */
  @Post('publish')
  @HttpCode(200)
  async publish(@Headers('authorization') auth?: string) {
    if (!this.config.adminToken) throw new NotFoundException();
    if (!sameSecret(auth?.replace(/^Bearer\s+/i, ''), this.config.adminToken))
      throw new UnauthorizedException();
    return this.channel.publishTelegram();
  }
}

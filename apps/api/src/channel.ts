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
];
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
): string {
  const tg = format === 'telegram';
  const bold = (s: string) => (tg ? `<b>${esc(s)}</b>` : `*${s}*`);
  const lines = [bold(`🛒 Ñapa · ofertas reales de hoy (${date})`), ''];
  deals.forEach((d, i) => {
    const off = d.realPct && d.realPct >= 1 ? ` (−${Math.round(d.realPct)} % real)` : '';
    const name = tg ? esc(d.title) : d.title;
    lines.push(`${i + 1}. ${name}`);
    lines.push(`   ${bold(cop(d.price))}${off} en ${tg ? esc(d.store) : d.store}`);
    lines.push(`   ${tg ? `<a href="${esc(d.href)}">Ver en la tienda</a>` : d.href}`);
    lines.push('');
  });
  if (deals.some((d) => d.affiliate))
    lines.push(
      'Algunos enlaces son de afiliado: si compras, Ñapa puede recibir una comisión sin costo para ti.',
    );
  lines.push(`Precios del momento; confírmalos en la tienda. Más en ${siteUrl}`);
  return lines.join('\n');
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
    for (const q of CHANNEL_TERMS) {
      const r = await this.search.search({ q, limit: 24 }, LIVE_STORES);
      for (const o of r.offers) if (o.source === 'live' && o.url) offers.set(o.id, o);
    }
    const scored = scoreOffers([...offers.values()], STORES);
    const honest = filterOffers(scored, { onlyHonest: true }).filter((s) =>
      GROCERY.has(s.offer.category),
    );
    // Primero las rebajas reales (según historial), luego el resto por puntaje.
    const ranked = sortOffers(bestPerProduct(honest), 'score');
    const discounted = ranked.filter((s) => (s.analysis.realPct ?? 0) >= 5);
    return [...discounted, ...ranked.filter((s) => !discounted.includes(s))]
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
    return { text: formatPost(deals, format, this.config.siteUrl, this.today()), deals };
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

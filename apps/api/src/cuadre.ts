import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
/** Lo mínimo de la respuesta de Express que se usa (sin depender de @types/express). */
interface Response {
  status(code: number): Response;
  set(headers: Record<string, string>): Response;
  send(body: Buffer): Response;
}
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import type { FetchLike } from '@napa/connectors';
import { APP_CONFIG, CLOCK, FETCH, type AppConfig } from './config';
import { integritySignature } from './wompi';

/**
 * Venta de plantillas de Excel de Cuadre (cuadrelaboral.com) con Wompi Web Checkout.
 * Precios fijos en el servidor, órdenes cifradas en el gist de persistencia, confirmación por
 * evento de Wompi (checksum) o consultando la transacción en Wompi, y enlaces de descarga firmados
 * de corta vida. Los archivos completos NO están en este repositorio público: se leen cifrados de
 * un gist (CUADRE_FILES_GIST_ID) y se descifran con CUADRE_FILES_KEY.
 */

export const CUADRE_FILES = {
  liquidacion: 'Cuadre-Liquidacion-2026.xlsx',
  nomina: 'Cuadre-Nomina-Pequeno-Negocio-2026.xlsx',
  presupuesto: 'Cuadre-Presupuesto-Personal.xlsx',
} as const;
type FileId = keyof typeof CUADRE_FILES;

export const CUADRE_SKUS: Record<string, { name: string; priceCop: number; files: FileId[] }> = {
  liquidacion: { name: 'Liquidación de contrato 2026', priceCop: 14_900, files: ['liquidacion'] },
  nomina: { name: 'Nómina pequeño negocio 2026', priceCop: 29_900, files: ['nomina'] },
  presupuesto: { name: 'Presupuesto personal 50/30/20', priceCop: 9_900, files: ['presupuesto'] },
  combo: {
    name: 'Combo las 3',
    priceCop: 39_900,
    files: ['liquidacion', 'nomina', 'presupuesto'],
  },
};

/** Vida de un enlace de descarga. */
export const DOWNLOAD_TTL_MS = 30 * 60_000;
/** Las órdenes pagadas se pueden volver a descargar desde /gracias durante este tiempo. */
export const PAID_WINDOW_MS = 7 * 24 * 3_600_000;
const PENDING_TTL_MS = 2 * 24 * 3_600_000;

export interface CuadreOrder {
  reference: string;
  sku: string;
  amountInCents: number;
  email: string | null;
  status: 'PENDING' | 'PAID' | 'DECLINED';
  transactionId: string | null;
  createdAt: string;
  paidAt: string | null;
}

export interface OrdersState {
  version: 1;
  orders: Record<string, CuadreOrder>;
}

export interface OrderStore {
  readonly kind: 'gist' | 'memory';
  load(): Promise<OrdersState>;
  save(state: OrdersState): Promise<void>;
}

const empty = (): OrdersState => ({ version: 1, orders: {} });

export class MemoryOrderStore implements OrderStore {
  readonly kind = 'memory' as const;
  private state = empty();
  async load() {
    return structuredClone(this.state);
  }
  async save(s: OrdersState) {
    this.state = structuredClone(s);
  }
}

function key(label: string, secret: string) {
  return createHash('sha256').update(`${label}:${secret}`).digest();
}

export function seal(data: Buffer, label: string, secret: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(label, secret), iv);
  const enc = Buffer.concat([c.update(data), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64');
}

export function unseal(b64: string, label: string, secret: string): Buffer {
  const raw = Buffer.from(b64, 'base64');
  const d = createDecipheriv('aes-256-gcm', key(label, secret), raw.subarray(0, 12));
  d.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([d.update(raw.subarray(28)), d.final()]);
}

const ORDERS_FILE = 'cuadre-orders.enc';

/** Mismo gist cifrado que las alertas (ALERTS_GIST_ID), en un archivo aparte. */
export class GistOrderStore implements OrderStore {
  readonly kind = 'gist' as const;
  private cache: OrdersState | null = null;
  constructor(
    private readonly gistId: string,
    private readonly token: string,
    private readonly secret: string,
    private readonly fetch: FetchLike,
  ) {}
  private headers() {
    return {
      authorization: `Bearer ${this.token}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'napa-api',
      'content-type': 'application/json',
    };
  }
  async load(): Promise<OrdersState> {
    if (this.cache) return structuredClone(this.cache);
    const res = await this.fetch(`https://api.github.com/gists/${this.gistId}`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`gist ${res.status}`);
    const body = (await res.json()) as { files?: Record<string, { content?: string }> };
    const content = body.files?.[ORDERS_FILE]?.content?.trim();
    this.cache = content
      ? (JSON.parse(unseal(content, 'cuadre-orders', this.secret).toString('utf8')) as OrdersState)
      : empty();
    return structuredClone(this.cache);
  }
  async save(s: OrdersState): Promise<void> {
    const content = seal(Buffer.from(JSON.stringify(s)), 'cuadre-orders', this.secret);
    const res = await this.fetch(`https://api.github.com/gists/${this.gistId}`, {
      method: 'PATCH',
      headers: this.headers(),
      body: JSON.stringify({ files: { [ORDERS_FILE]: { content } } }),
    });
    if (!res.ok) throw new Error(`gist ${res.status}`);
    this.cache = structuredClone(s);
  }
}

export const ORDER_STORE = Symbol('ORDER_STORE');

export function orderStoreFactory(config: AppConfig, fetch: FetchLike): OrderStore {
  const a = config.alerts;
  const secret = config.cuadre.eventsSecret;
  if (a && secret) return new GistOrderStore(a.gistId, a.githubToken, secret, fetch);
  new Logger('cuadre').warn(
    'órdenes de Cuadre en memoria (falta ALERTS_GIST_* o WOMPI_EVENTS_SECRET)',
  );
  return new MemoryOrderStore();
}

function safeEq(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function pick(obj: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined),
      obj,
    );
}

export interface WompiEvent {
  event?: string;
  data?: { transaction?: WompiTransaction };
  signature?: { properties?: string[]; checksum?: string };
  timestamp?: number | string;
}

export interface WompiTransaction {
  id?: string;
  status?: string;
  reference?: string;
  amount_in_cents?: number;
  currency?: string;
}

/** Checksum de eventos de Wompi: SHA256(valores de signature.properties + timestamp + secreto). */
export function eventChecksum(ev: WompiEvent, secret: string): string | null {
  const props = ev.signature?.properties;
  if (!Array.isArray(props) || !props.length || ev.timestamp === undefined) return null;
  const values = props.map((p) => pick(ev.data, p));
  if (values.some((v) => v === undefined || v === null)) return null;
  return createHash('sha256')
    .update(`${values.map(String).join('')}${ev.timestamp}${secret}`)
    .digest('hex');
}

export function downloadSignature(ref: string, file: string, exp: number, secret: string) {
  return createHmac('sha256', key('cuadre-dl', secret))
    .update(`${ref}.${file}.${exp}`)
    .digest('base64url');
}

@Injectable()
export class CuadreService {
  private readonly log = new Logger('cuadre');
  private files: Partial<Record<FileId, Buffer>> | null = null;
  /** Serializa lecturas-escrituras del estado para no pisar órdenes concurrentes. */
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(ORDER_STORE) private readonly store: OrderStore,
    @Inject(FETCH) private readonly fetch: FetchLike,
    @Inject(CLOCK) private readonly clock: () => Date,
  ) {}

  private mutate<T>(fn: (s: OrdersState) => T): Promise<T> {
    const run = this.queue.then(async () => {
      const s = await this.store.load();
      const out = fn(s);
      await this.store.save(s);
      return out;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  private prune(s: OrdersState) {
    const now = this.clock().getTime();
    for (const [ref, o] of Object.entries(s.orders)) {
      const age = now - Date.parse(o.createdAt);
      if ((o.status !== 'PAID' && age > PENDING_TTL_MS) || age > 90 * 24 * 3_600_000)
        delete s.orders[ref];
    }
  }

  async checkout(body: unknown) {
    const integrity = this.config.cuadre.integritySecret;
    if (!integrity || !this.config.cuadre.eventsSecret)
      throw new ServiceUnavailableException('Pagos de Cuadre no configurados');
    const b = (body ?? {}) as { sku?: unknown; email?: unknown };
    const sku = typeof b.sku === 'string' ? CUADRE_SKUS[b.sku] : undefined;
    if (!sku || !Object.hasOwn(CUADRE_SKUS, b.sku as string))
      throw new BadRequestException('sku inválido');
    let email: string | null = null;
    if (b.email !== undefined && b.email !== null && b.email !== '') {
      if (
        typeof b.email !== 'string' ||
        b.email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)
      )
        throw new BadRequestException('email inválido');
      email = b.email.trim().toLowerCase();
    }
    const reference =
      `CUA-${(b.sku as string).toUpperCase()}-${this.clock().getTime().toString(36)}-${randomBytes(6).toString('hex')}`.toUpperCase();
    const amountInCents = sku.priceCop * 100;
    await this.mutate((s) => {
      this.prune(s);
      s.orders[reference] = {
        reference,
        sku: b.sku as string,
        amountInCents,
        email,
        status: 'PENDING',
        transactionId: null,
        createdAt: this.clock().toISOString(),
        paidAt: null,
      };
    });
    return {
      reference,
      amountInCents,
      currency: 'COP' as const,
      signature: integritySignature(reference, amountInCents, 'COP', integrity),
      redirectUrl: `${this.config.cuadre.siteUrl}plantillas/gracias`,
    };
  }

  /** Aplica una transacción ya verificada (por checksum o leída de Wompi). */
  private async apply(tx: WompiTransaction): Promise<CuadreOrder | null> {
    const ref = tx.reference;
    if (typeof ref !== 'string' || !ref.startsWith('CUA-')) return null;
    return this.mutate((s) => {
      const o = s.orders[ref];
      if (!o) return null;
      if (o.status === 'PAID') return o;
      if (tx.status === 'APPROVED') {
        if (tx.amount_in_cents !== o.amountInCents || tx.currency !== 'COP') {
          this.log.warn(`monto/moneda no coinciden para ${ref}`);
          return o;
        }
        o.status = 'PAID';
        o.transactionId = String(tx.id ?? '');
        o.paidAt = this.clock().toISOString();
      } else if (tx.status === 'DECLINED' || tx.status === 'VOIDED' || tx.status === 'ERROR') {
        o.status = 'DECLINED';
      }
      return o;
    });
  }

  async event(ev: WompiEvent, headerChecksum?: string) {
    const secret = this.config.cuadre.eventsSecret;
    if (!secret) throw new ServiceUnavailableException();
    const expected = eventChecksum(ev, secret);
    const given = (ev.signature?.checksum ?? headerChecksum ?? '').toLowerCase();
    if (!expected || !safeEq(expected, given)) throw new ForbiddenException('checksum inválido');
    if (ev.event === 'transaction.updated' && ev.data?.transaction)
      await this.apply(ev.data.transaction);
    return { ok: true };
  }

  /** Respaldo si el evento tarda: lee la transacción en la API pública de Wompi. */
  private async verifyWithWompi(transactionId: string): Promise<void> {
    if (!/^[\w-]{1,64}$/.test(transactionId)) return;
    try {
      const res = await this.fetch(
        `${this.config.cuadre.wompiApiUrl}/transactions/${transactionId}`,
        {
          headers: { accept: 'application/json' },
        },
      );
      if (!res.ok) return;
      const body = (await res.json()) as { data?: WompiTransaction };
      if (body.data) await this.apply(body.data);
    } catch (e) {
      this.log.warn(`no se pudo consultar Wompi: ${(e as Error).message}`);
    }
  }

  async order(ref: string, transactionId?: string) {
    if (!/^CUA-[A-Z0-9-]{8,80}$/.test(ref)) throw new NotFoundException();
    let o = (await this.store.load()).orders[ref];
    if (!o) throw new NotFoundException();
    if (o.status === 'PENDING' && transactionId) {
      await this.verifyWithWompi(transactionId);
      o = (await this.store.load()).orders[ref]!;
    }
    const sku = CUADRE_SKUS[o.sku]!;
    const base = { reference: o.reference, sku: o.sku, name: sku.name, status: o.status };
    if (o.status !== 'PAID') return { ...base, downloads: [] };
    const now = this.clock().getTime();
    if (now - Date.parse(o.paidAt!) > PAID_WINDOW_MS)
      return { ...base, status: 'EXPIRED', downloads: [] };
    const exp = now + DOWNLOAD_TTL_MS;
    const secret = this.config.cuadre.eventsSecret!;
    const api = this.config.publicApiUrl?.replace(/\/$/, '') ?? '';
    return {
      ...base,
      downloads: sku.files.map((f) => ({
        name: CUADRE_FILES[f],
        url: `${api}/api/plantillas/download?ref=${encodeURIComponent(ref)}&file=${f}&exp=${exp}&sig=${downloadSignature(ref, f, exp, secret)}`,
        expiresAt: new Date(exp).toISOString(),
      })),
    };
  }

  async download(q: { ref?: string; file?: string; exp?: string; sig?: string }) {
    const secret = this.config.cuadre.eventsSecret;
    if (!secret) throw new ServiceUnavailableException();
    const { ref = '', file = '', sig = '' } = q;
    const exp = Number(q.exp);
    if (!Object.hasOwn(CUADRE_FILES, file) || !Number.isInteger(exp)) throw new NotFoundException();
    if (!safeEq(downloadSignature(ref, file, exp, secret), sig)) throw new ForbiddenException();
    if (exp < this.clock().getTime()) throw new ForbiddenException('enlace vencido');
    const o = (await this.store.load()).orders[ref];
    if (!o || o.status !== 'PAID' || !CUADRE_SKUS[o.sku]!.files.includes(file as FileId))
      throw new ForbiddenException();
    return { name: CUADRE_FILES[file as FileId], data: await this.file(file as FileId) };
  }

  private async file(id: FileId): Promise<Buffer> {
    const { filesGistId, filesKey } = this.config.cuadre;
    if (!filesGistId || !filesKey)
      throw new ServiceUnavailableException('archivos no configurados');
    if (!this.files?.[id]) {
      const res = await this.fetch(`https://api.github.com/gists/${filesGistId}`, {
        headers: { accept: 'application/vnd.github+json', 'user-agent': 'napa-api' },
      });
      if (!res.ok) throw new ServiceUnavailableException(`gist ${res.status}`);
      const body = (await res.json()) as { files?: Record<string, { content?: string }> };
      const files: Partial<Record<FileId, Buffer>> = {};
      for (const f of Object.keys(CUADRE_FILES) as FileId[]) {
        const c = body.files?.[`${f}.enc`]?.content?.trim();
        if (c) files[f] = unseal(c, 'cuadre-files', filesKey);
      }
      this.files = files;
    }
    const data = this.files[id];
    if (!data) throw new ServiceUnavailableException('archivo no disponible');
    return data;
  }
}

@Controller()
export class CuadreController {
  constructor(private readonly cuadre: CuadreService) {}

  @Post('plantillas/checkout')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  checkout(@Body() body: unknown) {
    return this.cuadre.checkout(body);
  }

  @Get('plantillas/order/:ref')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  order(@Param('ref') ref: string, @Query('id') id?: string) {
    return this.cuadre.order(ref, id);
  }

  @Get('plantillas/download')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async download(
    @Query() q: { ref?: string; file?: string; exp?: string; sig?: string },
    @Res() res: Response,
  ) {
    const { name, data } = await this.cuadre.download(q);
    res
      .status(200)
      .set({
        'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'content-disposition': `attachment; filename="${name}"`,
        'cache-control': 'private, no-store',
      })
      .send(data);
  }

  /** URL de eventos para el dashboard de Wompi: https://napa-api.onrender.com/api/wompi/events */
  @Post('wompi/events')
  @HttpCode(200)
  event(@Body() body: WompiEvent, @Headers('x-event-checksum') checksum?: string) {
    return this.cuadre.event(body, checksum);
  }
}

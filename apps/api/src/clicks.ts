import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Injectable,
  NotFoundException,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { STORE_IDS, todayInBogota } from '@napa/connectors';
import { timingSafeEqual } from 'node:crypto';
import { APP_CONFIG, CLOCK, type AppConfig } from './config';

const KINDS = ['producto', 'busqueda', 'canal'] as const;
type Kind = (typeof KINDS)[number];

export interface ClickStats {
  since: string;
  days: Record<
    string,
    Record<string, { producto: number; busqueda: number; canal: number; afiliado: number }>
  >;
}

/**
 * Cuenta salidas a las tiendas sin datos personales: solo día, tienda, tipo de enlace y si era
 * de afiliado. No guarda IP, User-Agent, cookies ni identificadores. Vive en memoria (se
 * reinicia cuando el plan gratuito duerme); conserva los últimos 60 días.
 */
@Injectable()
export class ClicksService {
  private readonly days = new Map<
    string,
    Map<string, { producto: number; busqueda: number; canal: number; afiliado: number }>
  >();
  private readonly since: string;

  constructor(@Inject(CLOCK) private readonly clock: () => Date) {
    this.since = clock().toISOString();
  }

  record(storeId: string, kind: Kind, affiliate: boolean): void {
    const day = todayInBogota(this.clock());
    let stores = this.days.get(day);
    if (!stores) {
      stores = new Map();
      this.days.set(day, stores);
      while (this.days.size > 60) this.days.delete(this.days.keys().next().value!);
    }
    const c = stores.get(storeId) ?? { producto: 0, busqueda: 0, canal: 0, afiliado: 0 };
    c[kind] += 1;
    if (affiliate) c.afiliado += 1;
    stores.set(storeId, c);
  }

  stats(): ClickStats {
    const days: ClickStats['days'] = {};
    for (const [day, stores] of this.days) days[day] = Object.fromEntries(stores);
    return { since: this.since, days };
  }
}

/** Compara secretos en tiempo constante. */
export function sameSecret(given: string | undefined, expected: string | null): boolean {
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

@Controller()
export class ClicksController {
  constructor(
    private readonly clicks: ClicksService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** POST /api/click?store=jumbo&kind=producto&aff=1 (lo envía navigator.sendBeacon). */
  @Post('click')
  @HttpCode(204)
  click(
    @Query('store') store?: string,
    @Query('kind') kind?: string,
    @Query('aff') aff?: string,
  ): void {
    if (!store || !STORE_IDS.includes(store) || !KINDS.includes(kind as Kind))
      throw new BadRequestException('Parámetros inválidos');
    this.clicks.record(store, kind as Kind, aff === '1');
  }

  /** GET /api/clicks con `Authorization: Bearer <ADMIN_TOKEN>`. Sin ADMIN_TOKEN no existe. */
  @Get('clicks')
  stats(@Headers('authorization') auth?: string): ClickStats {
    if (!this.config.adminToken) throw new NotFoundException();
    if (!sameSecret(auth?.replace(/^Bearer\s+/i, ''), this.config.adminToken))
      throw new UnauthorizedException();
    return this.clicks.stats();
  }
}

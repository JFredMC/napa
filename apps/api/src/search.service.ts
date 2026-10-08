import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  MercadoLibreAuth,
  STORES,
  STORE_IDS,
  createMercadoLibreConnector,
  createVtexConnector,
  simulatedConnectors,
  todayInBogota,
  vtexSearchPaths,
  type FetchLike,
  type SearchQuery,
  type StoreConnector,
} from '@napa/connectors';
import { clusterOffers, type Offer } from '@napa/deals-engine';
import { TtlCache } from './cache';
import { APP_CONFIG, CLOCK, FETCH, type AppConfig } from './config';
import { HostThrottle } from './host-throttle';
import { PriceLog } from './price-log';
import { RobotsService } from './robots.service';

/**
 * - `live`: la tienda respondió con precios reales.
 * - `blocked`: hay adaptador real, pero robots.txt, la API o un error lo impiden; se usa el simulado.
 * - `simulated`: la tienda no tiene fuente pública; siempre simulada.
 */
export type SourceMode = 'live' | 'blocked' | 'simulated';

export interface SourceStatus {
  storeId: string;
  name: string;
  mode: SourceMode;
  reason: string;
  count?: number;
  /** Última comprobación de acceso a una página pública permitida (solo Éxito y Carulla). */
  access?: AccessProbe;
}

export interface AccessProbe {
  url: string;
  /** Código HTTP, o 0 si no hubo respuesta. */
  status: number;
  /** La tienda rechazó al robot por ser un robot (p. ej. 429 con rate-limit-reason: bot). */
  botBlocked: boolean;
  checkedAt: string;
}

export interface SearchResult {
  query: SearchQuery;
  offers: Offer[];
  stores: SourceStatus[];
  fetchedAt: string;
}

interface LiveAdapter {
  connector: StoreConnector;
  host: string;
  /** Revisa robots.txt (VTEX) antes de consultar. */
  check?: (query: SearchQuery) => Promise<boolean>;
}

@Injectable()
export class SearchService {
  private readonly log = new Logger('search');
  private readonly simulated: Map<string, StoreConnector>;
  private readonly live = new Map<string, LiveAdapter>();
  private readonly cache: TtlCache<{ offers: Offer[]; status: SourceStatus }>;
  private readonly throttle: HostThrottle;
  private readonly prices = new PriceLog();
  /** Comprobaciones de acceso: como mucho una cada 12 h por tienda, y solo cuando alguien la pide. */
  private readonly probes: TtlCache<Promise<AccessProbe>>;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(FETCH) private readonly fetchFn: FetchLike,
    @Inject(CLOCK) private readonly clock: () => Date,
    private readonly robots: RobotsService,
  ) {
    this.simulated = new Map(
      simulatedConnectors(() => todayInBogota(this.clock())).map((c) => [c.storeId, c]),
    );
    this.cache = new TtlCache(config.cacheTtlMs, 500, () => this.clock().getTime());
    this.throttle = new HostThrottle(config.upstreamIntervalMs);
    this.probes = new TtlCache(12 * 3_600_000, 20, () => this.clock().getTime());

    for (const id of config.liveStores) {
      const store = STORES[id];
      if (store?.liveSource !== 'vtex' || !store.vtexOrigin) continue;
      const origin = store.vtexOrigin;
      const choosePath = (candidates: string[]) =>
        this.robots.choose(origin, candidates, store.respectDisallow);
      this.live.set(id, {
        connector: createVtexConnector({
          storeId: id,
          origin,
          fetch: fetchFn,
          userAgent: config.userAgent,
          now: this.clock,
          choosePath,
        }),
        host: new URL(origin).host,
        check: async (q) => (await choosePath(vtexSearchPaths(q))) !== null,
      });
    }
    if (config.mercadoLibre) {
      this.live.set('mercadolibre', {
        connector: createMercadoLibreConnector({
          auth: new MercadoLibreAuth({ ...config.mercadoLibre }, fetchFn),
          fetch: fetchFn,
          userAgent: config.userAgent,
          now: this.clock,
        }),
        host: 'api.mercadolibre.com',
      });
    }
  }

  /** Estado de cada fuente sin buscar nada (revisa robots.txt de las tiendas VTEX). */
  async sources(): Promise<SourceStatus[]> {
    return Promise.all(
      STORE_IDS.map(async (id): Promise<SourceStatus> => {
        const store = STORES[id]!;
        const adapter = this.live.get(id);
        if (!adapter)
          return {
            storeId: id,
            name: store.name,
            mode: 'simulated',
            reason: this.simulatedReason(id),
          };
        if (adapter.check && !(await adapter.check({ q: 'arroz' }))) {
          const access = store.accessProbeUrl
            ? await this.probeAccess(store.accessProbeUrl)
            : undefined;
          return {
            storeId: id,
            name: store.name,
            mode: 'blocked',
            reason:
              'Su robots.txt no permite consultar el catálogo; se usa el simulado.' +
              (access?.botBlocked
                ? ` Además, su protección anti-bots rechaza a un robot identificado (HTTP ${access.status}).`
                : ''),
            ...(access ? { access } : {}),
          };
        }
        return { storeId: id, name: store.name, mode: 'live', reason: 'Fuente real configurada.' };
      }),
    );
  }

  async search(query: SearchQuery, storeIds: readonly string[] = STORE_IDS): Promise<SearchResult> {
    const ids = storeIds.filter((id) => STORES[id]);
    const results = await Promise.all(ids.map((id) => this.searchStore(id, query)));
    const live = results.flatMap((r) => r.offers.filter((o) => o.source === 'live'));
    const simulated = results.flatMap((r) => r.offers.filter((o) => o.source !== 'live'));
    return {
      query,
      // Los precios reales solo se emparejan entre sí: nunca se compara un precio real con uno simulado.
      offers: [...clusterOffers(live), ...simulated],
      stores: results.map((r) => r.status),
      fetchedAt: this.clock().toISOString(),
    };
  }

  private async searchStore(
    id: string,
    query: SearchQuery,
  ): Promise<{ offers: Offer[]; status: SourceStatus }> {
    const name = STORES[id]!.name;
    const adapter = this.live.get(id);
    if (!adapter) {
      const offers = await this.simulated.get(id)!.search(query);
      return {
        offers,
        status: {
          storeId: id,
          name,
          mode: 'simulated',
          reason: this.simulatedReason(id),
          count: offers.length,
        },
      };
    }
    const key = `${id}|${query.q.toLowerCase()}|${query.category ?? ''}|${query.limit ?? ''}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    let result: { offers: Offer[]; status: SourceStatus };
    try {
      // Las tiendas VTEX revisan robots.txt dentro del adaptador (choosePath) antes de pedir nada.
      const offers = (
        await this.throttle.run(adapter.host, () => adapter.connector.search(query))
      ).map((o) => this.prices.record(o));
      result = {
        offers,
        status: {
          storeId: id,
          name,
          mode: 'live',
          reason: 'Precios reales de la tienda.',
          count: offers.length,
        },
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.log.warn(`${id}: ${message}`);
      const offers = await this.simulated.get(id)!.search(query);
      result = {
        offers,
        status: {
          storeId: id,
          name,
          mode: 'blocked',
          reason: `${message}. Se muestran precios simulados.`,
          count: offers.length,
        },
      };
    }
    this.cache.set(key, result);
    return result;
  }

  /**
   * Pide una sola página pública que robots.txt permite (el sitemap que el propio robots.txt
   * anuncia), con el User-Agent honesto y sin leer el cuerpo, para saber si la tienda acepta
   * robots identificados. No se reintenta, no se cambia de identidad y no se recorre nada.
   */
  private probeAccess(url: string): Promise<AccessProbe> {
    const cached = this.probes.get(url);
    if (cached) return cached;
    const host = new URL(url).host;
    const run = this.throttle.run(host, async (): Promise<AccessProbe> => {
      const checkedAt = this.clock().toISOString();
      try {
        const res = await this.fetchFn(url, {
          headers: { 'user-agent': this.config.userAgent },
          signal: AbortSignal.timeout(8000),
        });
        void res.body?.cancel().catch(() => undefined);
        const reason = res.headers.get('rate-limit-reason') ?? '';
        const botBlocked =
          /bot/i.test(reason) || res.status === 403 || (res.status === 429 && !reason);
        return { url, status: res.status, botBlocked, checkedAt };
      } catch {
        return { url, status: 0, botBlocked: false, checkedAt };
      }
    });
    this.probes.set(url, run);
    return run;
  }

  private simulatedReason(id: string): string {
    if (id === 'mercadolibre')
      return 'Sin credenciales OAuth de Mercado Libre configuradas; precios simulados.';
    const store = STORES[id]!;
    if (store.liveSource === 'vtex')
      return 'Adaptador VTEX desactivado en LIVE_STORES; precios simulados.';
    return 'Sin API pública: precios simulados.';
  }
}

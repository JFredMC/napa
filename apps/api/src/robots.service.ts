import { Inject, Injectable, Logger } from '@nestjs/common';
import { isAllowedByRobots, type FetchLike } from '@napa/connectors';
import { TtlCache } from './cache';
import { APP_CONFIG, FETCH, type AppConfig } from './config';

/**
 * Descarga y guarda (24 h) el robots.txt de cada tienda. Si no se puede leer, se asume que NO
 * hay permiso: ante la duda, no se consulta la tienda.
 */
@Injectable()
export class RobotsService {
  private readonly cache = new TtlCache<string | null>(24 * 3_600_000, 50);
  private readonly log = new Logger('robots');

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(FETCH) private readonly fetchFn: FetchLike,
  ) {}

  async allowed(origin: string, path: string): Promise<boolean> {
    let robots = this.cache.get(origin);
    if (robots === undefined) {
      robots = await this.download(origin);
      this.cache.set(origin, robots);
    }
    return robots !== null && isAllowedByRobots(robots, this.config.userAgent, path);
  }

  /**
   * Primera ruta permitida, o null. `respectDisallow` agrega prefijos que se tratan como
   * prohibidos aunque el robots.txt no los aplique técnicamente al grupo `*`.
   */
  async choose(
    origin: string,
    candidates: readonly string[],
    respectDisallow: readonly string[] = [],
  ): Promise<string | null> {
    for (const path of candidates) {
      if (respectDisallow.some((prefix) => path.startsWith(prefix))) continue;
      if (await this.allowed(origin, path)) return path;
    }
    return null;
  }

  private async download(origin: string): Promise<string | null> {
    try {
      const res = await this.fetchFn(`${origin}/robots.txt`, {
        headers: { 'user-agent': this.config.userAgent },
        signal: AbortSignal.timeout(5000),
      });
      // 4xx: no hay robots.txt, todo permitido (RFC 9309). 5xx: no disponible, nada permitido.
      if (res.status >= 400 && res.status < 500) return '';
      if (!res.ok) return null;
      return await res.text();
    } catch (e) {
      this.log.warn(`No se pudo leer ${origin}/robots.txt: ${(e as Error).message}`);
      return null;
    }
  }
}

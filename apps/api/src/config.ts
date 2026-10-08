import { STORE_IDS, affiliateRulesFromEnv } from '@napa/connectors';
/** Configuración por variables de entorno, con valores seguros para desarrollo local. */
export interface AppConfig {
  port: number;
  corsOrigins: string[];
  /** User-Agent que se identifica ante las tiendas (con enlace al repositorio). */
  userAgent: string;
  /** Tiendas VTEX que se intentan en vivo (cada una pasa además por su robots.txt). */
  liveStores: string[];
  /** Vida de la caché de búsquedas, en ms. */
  cacheTtlMs: number;
  /** Separación mínima entre dos peticiones al mismo dominio, en ms. */
  upstreamIntervalMs: number;
  /** Peticiones por minuto permitidas a cada cliente. */
  clientRpm: number;
  mercadoLibre: { clientId: string; clientSecret: string; refreshToken: string } | null;
  /** Protege los endpoints internos (/api/clicks, /api/channel/*). Sin él, no existen. */
  adminToken: string | null;
  /** Reglas de afiliado por tienda (NAPA_AFF_<TIENDA>), para los enlaces del canal. */
  affiliates: Partial<Record<string, string>>;
  /** URL pública del sitio (para enlaces en el canal). */
  siteUrl: string;
  telegram: { botToken: string; channelId: string } | null;
  /** Ofertas por publicación del canal. */
  channelTopN: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const port = Number(env['PORT'] ?? 3000);
  const num = (key: string, fallback: number, min: number) =>
    Math.max(min, Number(env[key] ?? fallback) || fallback);
  const list = (value: string) =>
    value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  const ml =
    env['ML_CLIENT_ID'] && env['ML_CLIENT_SECRET'] && env['ML_REFRESH_TOKEN']
      ? {
          clientId: env['ML_CLIENT_ID'],
          clientSecret: env['ML_CLIENT_SECRET'],
          refreshToken: env['ML_REFRESH_TOKEN'],
        }
      : null;
  return {
    port: Number.isInteger(port) && port > 0 ? port : 3000,
    corsOrigins: list(env['CORS_ORIGINS'] ?? 'http://localhost:4200,http://localhost:4310'),
    userAgent: env['USER_AGENT'] ?? 'NapaBot/0.1 (+https://github.com/JFredMC/napa)',
    liveStores: list(env['LIVE_STORES'] ?? 'jumbo,olimpica,exito,carulla'),
    cacheTtlMs: num('CACHE_TTL_MS', 10 * 60_000, 1000),
    upstreamIntervalMs: num('UPSTREAM_INTERVAL_MS', 1500, 0),
    clientRpm: num('CLIENT_RPM', 60, 1),
    mercadoLibre: ml,
    adminToken: env['ADMIN_TOKEN'] && env['ADMIN_TOKEN'].length >= 24 ? env['ADMIN_TOKEN'] : null,
    affiliates: affiliateRulesFromEnv(env, STORE_IDS),
    siteUrl: (env['SITE_URL'] ?? 'https://jfredmc.github.io/napa/').replace(/\/?$/, '/'),
    telegram:
      env['TELEGRAM_BOT_TOKEN'] && env['TELEGRAM_CHANNEL_ID']
        ? { botToken: env['TELEGRAM_BOT_TOKEN'], channelId: env['TELEGRAM_CHANNEL_ID'] }
        : null,
    channelTopN: Math.min(10, num('CHANNEL_TOP_N', 5, 1)),
  };
}

export const APP_CONFIG = Symbol('APP_CONFIG');
/** `fetch` inyectable: las pruebas lo reemplazan para no tocar la red. */
export const FETCH = Symbol('FETCH');
/** Reloj inyectable. */
export const CLOCK = Symbol('CLOCK');

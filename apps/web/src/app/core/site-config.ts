import { InjectionToken } from '@angular/core';
import raw from '../../site-config.json';

/** Configuración pública del sitio (la genera scripts/site-config.mjs desde variables NAPA_*). */
export interface SiteConfig {
  siteUrl: string;
  /** Enlaces de referido (afiliado) fuera del catálogo, p. ej. Temu. */
  promos?: { temu: { url: string; code: string | null } | null };
  /** Sobrescribe la URL del backend de environment.ts (p. ej. un dominio propio en Render). */
  apiUrl: string | null;
  affiliates: Partial<Record<string, string>>;
  adsense: { client: string; slots: { feed: string | null; product: string | null } } | null;
  analytics: { goatcounter: string | null; cloudflareToken: string | null };
  contactEmail: string | null;
  legalOwner: string | null;
  channels: { telegram: string | null; telegramBot?: string | null; whatsapp: string | null };
}

export const DEFAULT_SITE_CONFIG = raw as SiteConfig;
export const SITE_CONFIG = new InjectionToken<SiteConfig>('SITE_CONFIG', {
  factory: () => DEFAULT_SITE_CONFIG,
});

/** Hay algo que necesita consentimiento (analítica o anuncios). */
export function needsConsent(c: SiteConfig): boolean {
  return !!(c.adsense || c.analytics.goatcounter || c.analytics.cloudflareToken);
}

/** Deep link al bot: /start q_<base64url de la búsqueda>, máx. 64 caracteres (límite de Telegram). */
export function telegramAlertUrl(botUrl: string, query: string): string {
  const b64 = (s: string) =>
    btoa(String.fromCharCode(...new TextEncoder().encode(s)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  let q = query.replace(/\s+/g, ' ').trim();
  while (q && b64(q).length > 62) q = q.slice(0, -1);
  return `${botUrl}?start=q_${b64(q.trim())}`;
}

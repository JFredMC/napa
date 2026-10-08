import { InjectionToken } from '@angular/core';
import raw from '../../site-config.json';

/** Configuración pública del sitio (la genera scripts/site-config.mjs desde variables NAPA_*). */
export interface SiteConfig {
  siteUrl: string;
  /** Sobrescribe la URL del backend de environment.ts (p. ej. un dominio propio en Render). */
  apiUrl: string | null;
  affiliates: Partial<Record<string, string>>;
  adsense: { client: string; slots: { feed: string | null; product: string | null } } | null;
  analytics: { goatcounter: string | null; cloudflareToken: string | null };
  contactEmail: string | null;
  legalOwner: string | null;
  channels: { telegram: string | null; whatsapp: string | null };
}

export const DEFAULT_SITE_CONFIG = raw as SiteConfig;
export const SITE_CONFIG = new InjectionToken<SiteConfig>('SITE_CONFIG', {
  factory: () => DEFAULT_SITE_CONFIG,
});

/** Hay algo que necesita consentimiento (analítica o anuncios). */
export function needsConsent(c: SiteConfig): boolean {
  return !!(c.adsense || c.analytics.goatcounter || c.analytics.cloudflareToken);
}

import { Injectable, computed, inject, signal } from '@angular/core';
import { SITE_CONFIG, needsConsent } from './site-config';
import { readJson, writeJson } from './storage';

/** Versión del texto de consentimiento: si cambia, se vuelve a preguntar. */
export const CONSENT_VERSION = 1;
const KEY = 'napa:consent';

export interface Consent {
  version: number;
  /** Estadísticas agregadas y sin cookies (GoatCounter o Cloudflare Web Analytics). */
  analytics: boolean;
  /** Anuncios de Google AdSense (usan cookies). */
  ads: boolean;
  /** Anuncios personalizados según tus intereses (si no, AdSense muestra no personalizados). */
  personalizedAds: boolean;
  /** Fecha de la decisión (prueba de la autorización, Ley 1581). */
  decidedAt: string;
}

/**
 * Consentimiento para analítica y publicidad (Ley 1581 de 2012 y requisitos de Google).
 * Nada de terceros se carga antes de que la persona decida; "Solo necesarias" no carga nada.
 */
@Injectable({ providedIn: 'root' })
export class ConsentStore {
  private readonly config = inject(SITE_CONFIG);
  readonly required = needsConsent(this.config);
  readonly consent = signal<Consent | null>(this.load());
  /** Panel de preferencias abierto. */
  readonly editing = signal(false);
  readonly showBanner = computed(
    () => this.required && (this.consent() === null || this.editing()),
  );
  readonly analytics = computed(() => this.consent()?.analytics ?? false);
  readonly ads = computed(() => this.consent()?.ads ?? false);
  readonly personalizedAds = computed(
    () => (this.consent()?.ads && this.consent()?.personalizedAds) ?? false,
  );

  acceptAll(): void {
    this.save({ analytics: true, ads: true, personalizedAds: true });
  }

  rejectAll(): void {
    this.save({ analytics: false, ads: false, personalizedAds: false });
  }

  save(choice: Pick<Consent, 'analytics' | 'ads' | 'personalizedAds'>): void {
    const c: Consent = {
      version: CONSENT_VERSION,
      analytics: choice.analytics,
      ads: choice.ads,
      personalizedAds: choice.ads && choice.personalizedAds,
      decidedAt: new Date().toISOString(),
    };
    writeJson(KEY, c);
    const before = this.consent();
    this.consent.set(c);
    this.editing.set(false);
    // Retirar un permiso ya dado: recargar para que los scripts de terceros dejen de correr.
    if ((before?.analytics && !c.analytics) || (before?.ads && !c.ads)) this.reload();
  }

  open(): void {
    this.editing.set(true);
  }

  private load(): Consent | null {
    const c = readJson<Consent | null>(KEY, null);
    return c && c.version === CONSENT_VERSION ? c : null;
  }

  /** Separado para poder reemplazarlo en pruebas. */
  reload(): void {
    if (typeof location !== 'undefined') location.reload();
  }
}

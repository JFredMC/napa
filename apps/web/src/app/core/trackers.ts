import { DOCUMENT, Injectable, effect, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { ConsentStore } from './consent.store';
import { SITE_CONFIG } from './site-config';

interface GoatCounter {
  count?: (vars: { path: string; title?: string; event?: boolean }) => void;
}
type AdsQueue = unknown[] & { requestNonPersonalizedAds?: number; pauseAdRequests?: number };

declare global {
  interface Window {
    goatcounter?: GoatCounter;
    adsbygoogle?: AdsQueue;
  }
}

/**
 * Carga los scripts de terceros solo con configuración y consentimiento:
 * - Analítica sin cookies: GoatCounter (cuenta páginas en la SPA) o Cloudflare Web Analytics.
 * - Google AdSense; si no se aceptan anuncios personalizados, pide anuncios no personalizados.
 */
@Injectable({ providedIn: 'root' })
export class Trackers {
  private readonly doc = inject(DOCUMENT);
  private readonly config = inject(SITE_CONFIG);
  private readonly consent = inject(ConsentStore);
  private readonly router = inject(Router);
  private analyticsLoaded = false;
  private adsLoaded = false;

  start(): void {
    if (typeof window === 'undefined') return;
    effect(() => {
      if (this.consent.analytics()) this.loadAnalytics();
      if (this.consent.ads()) this.loadAds(this.consent.personalizedAds());
    });
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.pageview(e.urlAfterRedirects));
  }

  /** Evento sin datos personales (p. ej. "salida-jumbo-producto"). */
  event(name: string): void {
    if (this.analyticsLoaded) window.goatcounter?.count?.({ path: name, event: true });
  }

  private pageview(path: string): void {
    if (this.analyticsLoaded) window.goatcounter?.count?.({ path: path.split('?')[0] ?? path });
  }

  private loadAnalytics(): void {
    if (this.analyticsLoaded) return;
    const { goatcounter, cloudflareToken } = this.config.analytics;
    if (goatcounter) {
      this.script('https://gc.zgo.at/count.js', {
        'data-goatcounter': `https://${goatcounter}.goatcounter.com/count`,
        // La SPA cuenta cada navegación; la primera se cuenta al cargar el script.
        'data-goatcounter-settings': '{"allow_local":false}',
      });
    }
    if (cloudflareToken) {
      this.script('https://static.cloudflareinsights.com/beacon.min.js', {
        'data-cf-beacon': JSON.stringify({ token: cloudflareToken, spa: true }),
      });
    }
    this.analyticsLoaded = !!(goatcounter || cloudflareToken);
  }

  private loadAds(personalized: boolean): void {
    if (this.adsLoaded || !this.config.adsense) return;
    const queue = (window.adsbygoogle = window.adsbygoogle ?? []);
    if (!personalized) queue.requestNonPersonalizedAds = 1;
    this.script(
      `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(this.config.adsense.client)}`,
      { crossorigin: 'anonymous' },
    );
    this.adsLoaded = true;
  }

  private script(src: string, attrs: Record<string, string>): void {
    const s = this.doc.createElement('script');
    s.async = true;
    s.src = src;
    for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v);
    this.doc.head.appendChild(s);
  }
}

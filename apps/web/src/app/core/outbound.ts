import { Injectable, inject } from '@angular/core';
import { STORES, storeSearchUrl, withAffiliate, type OutboundLink } from '@napa/connectors';
import type { Offer } from '@napa/deals-engine';
import { API_URL } from './mode';
import { SITE_CONFIG } from './site-config';
import { Trackers } from './trackers';

export type OutboundKind = 'producto' | 'busqueda';

export interface StoreLink extends OutboundLink {
  storeId: string;
  kind: OutboundKind;
  label: string;
}

/** Atributo rel de todo enlace de salida a una tienda (Google: enlaces pagados o de afiliado). */
export const OUTBOUND_REL = 'sponsored nofollow noopener';

/**
 * Enlaces "Ir a la tienda": ficha real si la oferta es en vivo; si es simulada, la búsqueda
 * pública del producto en esa tienda (nunca una ficha inventada). Aplica la regla de afiliado
 * configurada y cuenta el clic sin datos personales.
 */
@Injectable({ providedIn: 'root' })
export class Outbound {
  private readonly config = inject(SITE_CONFIG);
  private readonly apiUrl = inject(API_URL);
  private readonly trackers = inject(Trackers);

  forOffer(offer: Offer): StoreLink | null {
    const store = STORES[offer.storeId];
    if (!store) return null;
    if (offer.source === 'live' && offer.url?.startsWith('https://')) {
      return {
        ...withAffiliate(offer.url, this.config.affiliates[offer.storeId]),
        storeId: offer.storeId,
        kind: 'producto',
        label: `Ir a ${store.name}`,
      };
    }
    return this.search(offer.storeId, offer.title);
  }

  search(storeId: string, q: string): StoreLink | null {
    const store = STORES[storeId];
    const url = store && storeSearchUrl(storeId, q, store.website);
    if (!store || !url) return null;
    return {
      ...withAffiliate(url, this.config.affiliates[storeId]),
      storeId,
      kind: 'busqueda',
      label: `Buscar en ${store.name}`,
    };
  }

  /**
   * Cuenta el clic: tienda, tipo y si llevaba afiliado. Sin cookies, IP, ni identificadores
   * (el servidor solo suma contadores por día).
   */
  track(link: StoreLink): void {
    this.trackers.event(`salida-${link.storeId}-${link.kind}`);
    if (!this.apiUrl || typeof navigator === 'undefined' || !navigator.sendBeacon) return;
    const q = new URLSearchParams({
      store: link.storeId,
      kind: link.kind,
      aff: link.affiliate ? '1' : '0',
    });
    try {
      navigator.sendBeacon(`${this.apiUrl}/api/click?${q.toString()}`);
    } catch {
      /* el conteo nunca bloquea la salida */
    }
  }
}

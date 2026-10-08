import { Injectable, computed, inject, signal } from '@angular/core';
import { STORES, simulatedConnectors, todayInBogota } from '@napa/connectors';
import { scoreOffers, type CategoryId, type Offer, type ScoredOffer } from '@napa/deals-engine';
import { API_URL, DEALS_MODE } from './mode';

export type SourceMode = 'live' | 'blocked' | 'simulated';

export interface SourceStatus {
  storeId: string;
  name: string;
  mode: SourceMode;
  reason: string;
  count?: number;
}

interface ApiSearch {
  offers: Offer[];
  stores: SourceStatus[];
  fetchedAt: string;
}

const API_CACHE = 'napa:api-offers';

/**
 * Fuente de ofertas de la app.
 * - Demo: los 11 adaptadores simulados corren en el navegador (datos ficticios del día).
 * - API: el backend local consulta las fuentes reales permitidas y simula el resto; cada
 *   oferta trae `source` y la interfaz lo muestra.
 */
@Injectable({ providedIn: 'root' })
export class CatalogStore {
  readonly mode = inject(DEALS_MODE);
  private readonly apiUrl = inject(API_URL);

  readonly offers = signal<Offer[]>([]);
  readonly statuses = signal<SourceStatus[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly fetchedAt = signal<string | null>(null);
  readonly lastQuery = signal<string | null>(null);

  readonly scored = computed<ScoredOffer[]>(() => scoreOffers(this.offers(), STORES));
  readonly byProduct = computed(() => {
    const map = new Map<string, ScoredOffer[]>();
    for (const s of this.scored())
      map.set(s.offer.productKey, [...(map.get(s.offer.productKey) ?? []), s]);
    return map;
  });
  readonly hasLive = computed(() => this.offers().some((o) => o.source === 'live'));

  private demoLoaded = false;

  constructor() {
    if (this.mode === 'demo') void this.loadDemo();
    else this.restoreApiCache();
  }

  /** Ofertas del mismo producto (todas las tiendas), de la más barata a la más cara. */
  product(key: string): ScoredOffer[] {
    return (this.byProduct().get(key) ?? []).slice().sort((a, b) => a.landed - b.landed);
  }

  /** Modo API: busca en el backend (q vacío = búsqueda general) y acumula los resultados. */
  async search(q: string, category?: CategoryId): Promise<void> {
    if (this.mode !== 'api' || !this.apiUrl) return;
    const key = `${q}|${category ?? ''}`;
    if (this.lastQuery() === key) return;
    this.lastQuery.set(key);
    this.loading.set(true);
    this.error.set(null);
    try {
      const params = new URLSearchParams({ q: q || 'oferta', limit: '24' });
      if (category) params.set('category', category);
      const res = await fetch(`${this.apiUrl}/api/search?${params.toString()}`);
      if (!res.ok) throw new Error(`El backend respondió ${res.status}`);
      const data = (await res.json()) as ApiSearch;
      const merged = new Map(this.offers().map((o) => [o.id, o]));
      for (const o of data.offers) merged.set(o.id, o);
      this.offers.set([...merged.values()]);
      this.statuses.set(data.stores);
      this.fetchedAt.set(data.fetchedAt);
      try {
        sessionStorage.setItem(API_CACHE, JSON.stringify([...merged.values()].slice(-600)));
      } catch {
        /* sin espacio */
      }
    } catch (e) {
      this.lastQuery.set(null);
      this.error.set(`No se pudo consultar el backend en ${this.apiUrl}: ${(e as Error).message}`);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadDemo(): Promise<void> {
    if (this.demoLoaded) return;
    this.demoLoaded = true;
    this.loading.set(true);
    const day = todayInBogota();
    const results = await Promise.all(
      simulatedConnectors(() => day).map((c) => c.search({ q: '' })),
    );
    this.offers.set(results.flat());
    this.statuses.set(
      Object.values(STORES).map((s) => ({
        storeId: s.id,
        name: s.name,
        mode: 'simulated',
        reason: 'Modo demo: precios simulados en el navegador.',
      })),
    );
    this.fetchedAt.set(new Date().toISOString());
    this.loading.set(false);
  }

  private restoreApiCache(): void {
    try {
      const raw = sessionStorage.getItem(API_CACHE);
      if (raw) this.offers.set(JSON.parse(raw) as Offer[]);
    } catch {
      /* ignore */
    }
  }
}

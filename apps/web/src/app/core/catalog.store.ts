import { isPlatformServer } from '@angular/common';
import { Injectable, PLATFORM_ID, PendingTasks, computed, inject, signal } from '@angular/core';
import { STORES, simulatedConnectors, todayInBogota } from '@napa/connectors';
import { scoreOffers, type CategoryId, type Offer, type ScoredOffer } from '@napa/deals-engine';
import { API_URL, MODE_PREFERENCE, waitForHealth, type DealsMode } from './mode';
import { SNAPSHOT_LOADER, type Snapshot } from './snapshot';

/**
 * Qué datos se ven: `demo` (simulados en el navegador), `api` (backend en vivo) o `snapshot`
 * (la última foto de precios reales guardada al compilar el sitio).
 */
export type DataMode = DealsMode | 'snapshot';

export type SourceMode = 'live' | 'blocked' | 'simulated';

export interface SourceStatus {
  storeId: string;
  name: string;
  mode: SourceMode;
  reason: string;
  count?: number;
  access?: { url: string; status: number; botBlocked: boolean; checkedAt: string };
}

/**
 * Conexión con el backend:
 * - `off`: modo demo elegido o sin backend configurado.
 * - `checking`: preguntando a /api/health (aún sin mostrar nada).
 * - `waking`: tarda; Render está arrancando el servicio gratuito. Mientras tanto se ve la foto
 *   de precios reales guardada (o la demo si no hay foto).
 * - `ready`: el backend respondió; modo API.
 * - `down`: no respondió a tiempo; se quedó en la foto guardada (o en demo).
 */
export type Connection = 'off' | 'checking' | 'waking' | 'ready' | 'down';

/** Tras este tiempo sin respuesta se avisa que el servidor está despertando. */
export const WAKING_AFTER_MS = 1500;
/** Plazo total para que despierte antes de quedarse en demo. */
export const WAKE_DEADLINE_MS = 75_000;

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
 * - Foto: precios reales guardados al compilar. Es lo que se prerenderiza para buscadores y lo
 *   que se ve mientras el servidor gratuito despierta.
 */
@Injectable({ providedIn: 'root' })
export class CatalogStore {
  private readonly apiUrl = inject(API_URL);
  private readonly loadSnapshotFile = inject(SNAPSHOT_LOADER);
  private readonly pending = inject(PendingTasks);
  private readonly server = isPlatformServer(inject(PLATFORM_ID));
  readonly preference = inject(MODE_PREFERENCE);
  /** Qué datos se muestran ahora. */
  readonly mode = signal<DataMode>(
    this.server ? 'snapshot' : this.preference === 'demo' || !this.apiUrl ? 'demo' : 'api',
  );
  readonly connection = signal<Connection>(this.mode() === 'api' ? 'checking' : 'off');
  /** Fecha de la foto de precios reales, si hay. */
  readonly snapshotAt = signal<string | null>(null);
  /** Segundos esperando a que despierte el servidor. */
  readonly wakingSeconds = signal(0);

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
  private snapshot: Promise<Snapshot | null> | null = null;

  constructor() {
    if (this.server) void this.pending.run(() => this.showSnapshot());
    else if (this.mode() === 'demo') void this.loadDemo();
    else void this.connect();
  }

  /** La foto de precios reales (una sola descarga, en un chunk aparte). */
  private getSnapshot(): Promise<Snapshot | null> {
    this.snapshot ??= this.loadSnapshotFile()
      .then((s) => (s.offers.length ? s : null))
      .catch(() => null);
    return this.snapshot;
  }

  /** Muestra la foto guardada; sin foto, la demo. */
  private async showSnapshot(): Promise<void> {
    const snap = await this.getSnapshot();
    if (this.connection() === 'ready') return;
    if (!snap) {
      // Sin foto: la demo, pero no en el primer segundo y medio (el servidor puede responder ya).
      if (this.connection() === 'checking') return;
      this.mode.set('demo');
      await this.loadDemo();
      return;
    }
    this.mode.set('snapshot');
    this.offers.set(snap.offers);
    this.snapshotAt.set(snap.fetchedAt);
    this.fetchedAt.set(snap.fetchedAt);
    const counts = new Map<string, number>();
    for (const o of snap.offers) counts.set(o.storeId, (counts.get(o.storeId) ?? 0) + 1);
    this.statuses.set(
      [...counts].map(([storeId, count]) => ({
        storeId,
        name: STORES[storeId]?.name ?? storeId,
        mode: 'live',
        reason: 'Foto de precios reales guardada por el servidor de Ñapa.',
        count,
      })),
    );
    // Mientras se conecta, la carga la maneja connect() (un producto compartido puede llegar
    // del backend aunque no esté en la foto).
    if (this.connection() === 'off' || this.connection() === 'down') this.loading.set(false);
  }

  /** Despierta el backend; si no responde a tiempo, se queda en demo. */
  async connect(): Promise<void> {
    if (!this.apiUrl) return;
    this.connection.set('checking');
    this.loading.set(true);
    // Precios reales guardados desde el primer instante (el HTML prerenderizado ya los mostraba).
    void this.showSnapshot();
    const started = Date.now();
    const tick = setInterval(() => {
      const ms = Date.now() - started;
      this.wakingSeconds.set(Math.floor(ms / 1000));
      if (ms >= WAKING_AFTER_MS && this.connection() === 'checking') {
        this.connection.set('waking');
        // Sin foto guardada, mientras arranca se ve la demo (marcada como simulada).
        if (this.mode() === 'api') void this.showSnapshot();
      }
    }, 250);
    const ok = await waitForHealth(this.apiUrl, { deadlineMs: WAKE_DEADLINE_MS, retryMs: 3000 });
    clearInterval(tick);
    if (ok) {
      // La foto queda como base (así los enlaces compartidos a un producto siguen abriendo) y
      // lo que traiga el backend la reemplaza oferta por oferta.
      const snap = await this.getSnapshot();
      this.offers.set(snap?.offers ?? []);
      this.statuses.set([]);
      this.restoreApiCache();
      this.connection.set('ready');
      this.mode.set('api');
      this.loading.set(false);
    } else {
      this.connection.set('down');
      await this.showSnapshot();
    }
  }

  /** Ofertas del mismo producto (todas las tiendas), de la más barata a la más cara. */
  product(key: string): ScoredOffer[] {
    return (this.byProduct().get(key) ?? []).slice().sort((a, b) => a.landed - b.landed);
  }

  /** Modo API: busca en el backend (q vacío = búsqueda general) y acumula los resultados. */
  async search(q: string, category?: CategoryId): Promise<void> {
    if (this.mode() !== 'api' || this.connection() !== 'ready' || !this.apiUrl) return;
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
    if (this.demoLoaded) {
      this.loading.set(false);
      return;
    }
    this.demoLoaded = true;
    this.loading.set(true);
    const day = todayInBogota();
    const results = await Promise.all(
      simulatedConnectors(() => day).map((c) => c.search({ q: '' })),
    );
    if (this.connection() === 'ready') return;
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
      if (!raw) return;
      const merged = new Map(this.offers().map((o) => [o.id, o]));
      for (const o of JSON.parse(raw) as Offer[]) merged.set(o.id, o);
      this.offers.set([...merged.values()]);
    } catch {
      /* ignore */
    }
  }
}

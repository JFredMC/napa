import { Injectable, computed, signal } from '@angular/core';
import { BRAND_RULES } from '@napa/connectors';
import { haversineKm, matchBrand, overpassQuery, type LatLng } from '@napa/deals-engine';

export interface Place {
  id: string;
  name: string;
  /** Tienda de Ñapa reconocida por marca/nombre, o null. */
  storeId: string | null;
  shop: string;
  lat: number;
  lng: number;
  distanceKm: number;
  address?: string;
}

export type LocationState = 'idle' | 'locating' | 'loading' | 'ready' | 'denied' | 'error';

/** Servidor principal de Overpass y un espejo público por si el primero está saturado. */
export const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
/** Ubicación de ejemplo: Chapinero, Bogotá. */
export const SAMPLE_CENTER: LatLng = { lat: 4.6486, lng: -74.0628 };
const CACHE_MS = 15 * 60_000;

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/** Convierte la respuesta de Overpass en sedes, reconociendo las cadenas de Ñapa. */
export function parseOverpass(elements: readonly OverpassElement[], center: LatLng): Place[] {
  return elements
    .map((e): Place | null => {
      const lat = e.lat ?? e.center?.lat;
      const lng = e.lon ?? e.center?.lon;
      const tags = e.tags ?? {};
      if (lat === undefined || lng === undefined) return null;
      const name = tags['name'] ?? tags['brand'] ?? '';
      if (!name) return null;
      const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' # ');
      return {
        id: `${e.type}/${e.id}`,
        name,
        storeId: matchBrand(tags, BRAND_RULES),
        shop: tags['shop'] ?? 'shop',
        lat,
        lng,
        distanceKm: haversineKm(center, { lat, lng }),
        ...(street ? { address: street } : {}),
      };
    })
    .filter((p): p is Place => !!p)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

/** Consulta Overpass probando el servidor principal y luego el espejo. */
async function fetchOverpass(query: string): Promise<OverpassElement[]> {
  let last = 'OpenStreetMap no respondió';
  for (const url of OVERPASS_URLS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (res.ok) return ((await res.json()) as { elements?: OverpassElement[] }).elements ?? [];
      last = `Overpass respondió ${res.status}`;
    } catch {
      last = 'sin conexión con OpenStreetMap';
    }
  }
  throw new Error(last);
}

/**
 * Ubicación (solo si el usuario la pide) y sedes cercanas desde OpenStreetMap vía Overpass.
 * La ubicación no se guarda ni se envía a otro lado que no sea la consulta a Overpass.
 */
@Injectable({ providedIn: 'root' })
export class LocationStore {
  readonly state = signal<LocationState>('idle');
  readonly center = signal<LatLng | null>(null);
  readonly isSample = signal(false);
  readonly radius = signal(1500);
  readonly places = signal<Place[]>([]);
  readonly error = signal<string | null>(null);
  private request = 0;

  readonly matched = computed(() => this.places().filter((p) => p.storeId));
  readonly nearbyStoreIds = computed(() => [
    ...new Set(this.matched().map((p) => p.storeId as string)),
  ]);

  locate(): void {
    if (!('geolocation' in navigator)) {
      this.state.set('error');
      this.error.set('Este navegador no permite obtener la ubicación.');
      return;
    }
    this.state.set('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.isSample.set(false);
        void this.load({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        this.state.set(err.code === err.PERMISSION_DENIED ? 'denied' : 'error');
        this.error.set(
          err.code === err.PERMISSION_DENIED
            ? 'Permiso de ubicación negado.'
            : 'No se pudo obtener la ubicación.',
        );
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 300_000 },
    );
  }

  useSample(): void {
    this.isSample.set(true);
    void this.load(SAMPLE_CENTER);
  }

  setRadius(m: number): void {
    this.radius.set(m);
    const c = this.center();
    if (c) void this.load(c);
  }

  async load(center: LatLng): Promise<void> {
    const id = ++this.request;
    this.center.set(center);
    this.state.set('loading');
    this.error.set(null);
    const query = overpassQuery(center, this.radius());
    const key = `napa:overpass:${center.lat.toFixed(3)},${center.lng.toFixed(3)},${this.radius()}`;
    try {
      let elements: OverpassElement[] | null = null;
      try {
        const cached = JSON.parse(sessionStorage.getItem(key) ?? 'null') as {
          at: number;
          elements: OverpassElement[];
        } | null;
        if (cached && Date.now() - cached.at < CACHE_MS) elements = cached.elements;
      } catch {
        /* ignore */
      }
      if (!elements) {
        elements = await fetchOverpass(query);
        try {
          sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), elements }));
        } catch {
          /* ignore */
        }
      }
      if (id !== this.request) return;
      this.places.set(parseOverpass(elements, center));
      this.state.set('ready');
    } catch (e) {
      if (id !== this.request) return;
      this.places.set([]);
      this.state.set('error');
      this.error.set(
        `No se pudieron cargar las tiendas cercanas: ${(e as Error).message}. Intenta de nuevo en un momento.`,
      );
    }
  }
}

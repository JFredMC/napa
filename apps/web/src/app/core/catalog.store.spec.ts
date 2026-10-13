import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Offer } from '@napa/deals-engine';
import { CatalogStore } from './catalog.store';
import { API_URL, MODE_PREFERENCE, type ModePreference } from './mode';
import { SNAPSHOT_LOADER, type Snapshot } from './snapshot';

const LIVE: Offer = {
  id: 'jumbo-1',
  productKey: 'jumbo-1',
  storeId: 'jumbo',
  title: 'Arroz Diana 5 kg',
  brand: 'DIANA',
  category: 'despensa',
  price: 21900,
  listPrice: 23900,
  url: 'https://www.jumbocolombia.com/arroz-diana/p',
  source: 'live',
  observedAt: '2026-10-08T11:00:00.000Z',
  history: [{ date: '2026-10-08', price: 21900, listPrice: 23900 }],
} as Offer;
const SNAP: Snapshot = { fetchedAt: '2026-10-08T11:00:00.000Z', offers: [LIVE] };
const EMPTY: Snapshot = { fetchedAt: null, offers: [] };

function setup(
  preference: ModePreference,
  { apiUrl = 'https://api.test', snapshot = EMPTY, platform = 'browser' } = {} as {
    apiUrl?: string | null;
    snapshot?: Snapshot;
    platform?: string;
  },
) {
  TestBed.configureTestingModule({
    providers: [
      { provide: API_URL, useValue: apiUrl },
      { provide: MODE_PREFERENCE, useValue: preference },
      { provide: SNAPSHOT_LOADER, useValue: async () => snapshot },
      { provide: PLATFORM_ID, useValue: platform },
    ],
  });
  return TestBed.inject(CatalogStore);
}

describe('CatalogStore: conexión con el servidor', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('demo elegida: no llama al servidor', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const store = setup('demo', { snapshot: SNAP });
    await vi.waitFor(() => expect(store.offers().length).toBeGreaterThan(1));
    expect(store.mode()).toBe('demo');
    expect(store.connection()).toBe('off');
    expect(store.offers().every((o) => o.source === 'simulated')).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('auto: si /api/health responde, pasa a modo API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"status":"ok"}', { status: 200 })),
    );
    const store = setup('auto');
    expect(store.connection()).toBe('checking');
    await vi.waitFor(() => expect(store.connection()).toBe('ready'));
    expect(store.mode()).toBe('api');
    expect(store.offers()).toEqual([]);
  });

  it('modo API: la foto guardada queda como base para que los enlaces compartidos abran', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"status":"ok"}', { status: 200 })),
    );
    const store = setup('auto', { snapshot: SNAP });
    await vi.waitFor(() => expect(store.connection()).toBe('ready'));
    expect(store.product('jumbo-1')).toHaveLength(1);
  });

  it('servidor dormido: muestra la foto de precios reales y no la demo', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => undefined)),
    );
    const store = setup('auto', { snapshot: SNAP });
    await vi.advanceTimersByTimeAsync(2000);
    expect(store.connection()).toBe('waking');
    expect(store.mode()).toBe('snapshot');
    expect(store.offers()).toEqual([LIVE]);
    expect(store.snapshotAt()).toBe(SNAP.fetchedAt);
  });

  it('sin foto guardada, mientras despierta se ve la demo', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => undefined)),
    );
    const store = setup('auto');
    await vi.advanceTimersByTimeAsync(2000);
    expect(store.connection()).toBe('waking');
    expect(store.mode()).toBe('demo');
  });

  it('al prerenderizar (servidor): solo la foto, sin llamar al backend', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const store = setup('auto', { snapshot: SNAP, platform: 'server' });
    await vi.waitFor(() => expect(store.offers()).toEqual([LIVE]));
    expect(store.mode()).toBe('snapshot');
    expect(store.connection()).toBe('off');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

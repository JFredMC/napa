import { TestBed } from '@angular/core/testing';
import { CatalogStore } from './catalog.store';
import { API_URL, MODE_PREFERENCE, type ModePreference } from './mode';

function setup(preference: ModePreference, apiUrl: string | null = 'https://api.test') {
  TestBed.configureTestingModule({
    providers: [
      { provide: API_URL, useValue: apiUrl },
      { provide: MODE_PREFERENCE, useValue: preference },
    ],
  });
  return TestBed.inject(CatalogStore);
}

describe('CatalogStore: conexión con el servidor', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('demo elegida: no llama al servidor', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const store = setup('demo');
    await vi.waitFor(() => expect(store.offers().length).toBeGreaterThan(0));
    expect(store.mode()).toBe('demo');
    expect(store.connection()).toBe('off');
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
});

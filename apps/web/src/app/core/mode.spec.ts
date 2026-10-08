import { MODE_KEY, resolvePreference, waitForHealth } from './mode';

describe('resolvePreference', () => {
  beforeEach(() => localStorage.clear());

  it('sin URL de API siempre es demo', () => {
    expect(resolvePreference(null, localStorage, '?mode=api')).toBe('demo');
  });

  it('con API: por defecto auto; ?mode manda y se recuerda', () => {
    expect(resolvePreference('https://x.test', localStorage, '')).toBe('auto');
    expect(resolvePreference('https://x.test', localStorage, '?mode=api')).toBe('api');
    expect(localStorage.getItem(MODE_KEY)).toBe('api');
    expect(resolvePreference('https://x.test', localStorage, '')).toBe('api');
    expect(resolvePreference('https://x.test', localStorage, '?mode=demo')).toBe('demo');
    expect(resolvePreference('https://x.test', localStorage, '')).toBe('demo');
  });
});

describe('waitForHealth', () => {
  function clock() {
    let t = 0;
    return {
      now: () => t,
      sleep: async (ms: number) => {
        t += ms;
      },
      advance: (ms: number) => (t += ms),
    };
  }

  it('listo apenas /api/health responde 200, reintentando 502 mientras despierta', async () => {
    const c = clock();
    const calls: string[] = [];
    const statuses = [502, 503, 200];
    const ok = await waitForHealth('https://x.test', {
      deadlineMs: 60_000,
      retryMs: 3000,
      now: c.now,
      sleep: c.sleep,
      fetch: (async (url: string) => {
        calls.push(url);
        return new Response('', { status: statuses.shift() ?? 500 });
      }) as typeof fetch,
    });
    expect(ok).toBe(true);
    expect(calls).toEqual(Array(3).fill('https://x.test/api/health'));
  });

  it('se rinde al vencer el plazo', async () => {
    const c = clock();
    let calls = 0;
    const ok = await waitForHealth('https://x.test', {
      deadlineMs: 10_000,
      retryMs: 3000,
      now: c.now,
      sleep: c.sleep,
      fetch: (async () => {
        calls += 1;
        c.advance(1000);
        throw new TypeError('Failed to fetch');
      }) as typeof fetch,
    });
    expect(ok).toBe(false);
    expect(calls).toBe(3);
  });
});

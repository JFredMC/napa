import { decrypt, emptyState, encrypt, GistStore, GistStoreError } from './store';

const SECRET = 'bot-token';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function store(fetch: (url: string, init?: RequestInit) => Promise<Response>): GistStore {
  return new GistStore('abc', 'gh-token', SECRET, fetch);
}

describe('GistStore', () => {
  it('lee y guarda el estado cifrado', async () => {
    const state = emptyState();
    state.lastCheck = '2026-11-12T20:03:24.000Z';
    const enc = encrypt(JSON.stringify(state), SECRET);
    const calls: { url: string; init?: RequestInit }[] = [];
    const fetch = async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (init?.method === 'PATCH') return jsonResponse({});
      return jsonResponse({ files: { 'alerts.enc': { content: enc } } });
    };
    const gist = store(fetch);
    expect(await gist.load()).toEqual(state);
    const next = await gist.load();
    next.users['1'] = { alerts: [], nextId: 1 };
    await gist.save(next);
    const patch = JSON.parse(String(calls[1]!.init?.body)) as {
      files: { 'alerts.enc': { content: string } };
    };
    expect(decrypt(patch.files['alerts.enc'].content, SECRET)).toContain('"1"');
    const headers = calls[0]!.init?.headers as Record<string, string>;
    expect(headers['authorization']).toBe('Bearer gh-token');
    expect(calls).toHaveLength(2);
  });

  it('si GitHub rechaza el token, el error dice qué renovar', async () => {
    const fetch = async () => jsonResponse({ message: 'Bad credentials' }, 401);
    const err = await store(fetch)
      .load()
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GistStoreError);
    expect((err as GistStoreError).status).toBe(401);
    expect((err as GistStoreError).message).toMatch(/ALERTS_GITHUB_TOKEN/);
    expect((err as GistStoreError).message).toMatch(/HTTP 401/);
  });

  it('403 se trata igual que un token sin permiso', async () => {
    const fetch = async () => new Response('nope', { status: 403 });
    await expect(store(fetch).save(emptyState())).rejects.toThrow(/HTTP 403/);
  });

  it('404 indica que el gist no existe o no es de esa cuenta', async () => {
    const fetch = async () => new Response('missing', { status: 404 });
    await expect(store(fetch).load()).rejects.toThrow(/ALERTS_GIST_ID/);
  });

  it('un contenido que no se descifra nombra la clave', async () => {
    const fetch = async () =>
      jsonResponse({ files: { 'alerts.enc': { content: 'no-es-cifrado' } } });
    await expect(store(fetch).load()).rejects.toThrow(/TELEGRAM_BOT_TOKEN/);
  });

  it('un fallo de red no se informa como HTTP 500 opaco', async () => {
    const fetch = async () => {
      throw new Error('network down');
    };
    await expect(store(fetch).load()).rejects.toThrow(/network down/);
  });
});

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { FetchLike } from '@napa/connectors';

export interface Alert {
  id: number;
  /** Búsqueda que se sigue ("arroz roa 1kg"). */
  q: string;
  /** Precio objetivo opcional: avisa cuando el mínimo baja de aquí. */
  target: number | null;
  /** Último mínimo visto (para detectar bajadas). */
  last: number | null;
  createdAt: string;
}

export interface AlertsState {
  version: 1;
  users: Record<string, { alerts: Alert[]; nextId: number }>;
  lastCheck: string | null;
}

export const emptyState = (): AlertsState => ({ version: 1, users: {}, lastCheck: null });

export interface AlertStore {
  readonly kind: 'gist' | 'memory';
  load(): Promise<AlertsState>;
  save(state: AlertsState): Promise<void>;
}

/** Solo memoria: sirve para pruebas y como respaldo; se pierde al reiniciar Render. */
export class MemoryStore implements AlertStore {
  readonly kind = 'memory' as const;
  private state = emptyState();
  async load() {
    return structuredClone(this.state);
  }
  async save(state: AlertsState) {
    this.state = structuredClone(state);
  }
}

/** AES-256-GCM: el gist guarda solo texto cifrado (ids de chat y búsquedas son privados). */
export function encrypt(json: string, secret: string): string {
  const key = createHash('sha256').update(`napa-alerts:${secret}`).digest();
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([c.update(json, 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), data]).toString('base64');
}

export function decrypt(b64: string, secret: string): string {
  const raw = Buffer.from(b64, 'base64');
  const key = createHash('sha256').update(`napa-alerts:${secret}`).digest();
  const d = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
  d.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8');
}

/**
 * Persistencia gratuita para el plan free de Render (sin disco): un gist secreto con el estado
 * cifrado. Necesita ALERTS_GIST_ID y un token de GitHub con permiso solo para gists.
 */
export class GistStore implements AlertStore {
  readonly kind = 'gist' as const;
  private cache: AlertsState | null = null;
  constructor(
    private readonly gistId: string,
    private readonly token: string,
    private readonly secret: string,
    private readonly fetch: FetchLike,
  ) {}

  private headers() {
    return {
      authorization: `Bearer ${this.token}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'napa-api',
      'content-type': 'application/json',
    };
  }

  async load(): Promise<AlertsState> {
    if (this.cache) return structuredClone(this.cache);
    const res = await this.fetch(`https://api.github.com/gists/${this.gistId}`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`gist ${res.status}`);
    const body = (await res.json()) as { files?: Record<string, { content?: string }> };
    const content = body.files?.['alerts.enc']?.content?.trim();
    this.cache = content
      ? (JSON.parse(decrypt(content, this.secret)) as AlertsState)
      : emptyState();
    return structuredClone(this.cache);
  }

  async save(state: AlertsState): Promise<void> {
    const res = await this.fetch(`https://api.github.com/gists/${this.gistId}`, {
      method: 'PATCH',
      headers: this.headers(),
      body: JSON.stringify({
        files: { 'alerts.enc': { content: encrypt(JSON.stringify(state), this.secret) } },
      }),
    });
    if (!res.ok) throw new Error(`gist ${res.status}`);
    this.cache = structuredClone(state);
  }
}

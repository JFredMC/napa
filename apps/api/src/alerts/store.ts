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

/**
 * Fallo al leer o escribir el gist. El mensaje no incluye el token ni el id: sirve para el log
 * de Render y para el cuerpo de `/api/alerts/check`.
 */
export class GistStoreError extends Error {
  readonly status: number | null;
  readonly operation: 'load' | 'save';

  constructor(message: string, status: number | null, operation: 'load' | 'save') {
    super(message);
    this.name = 'GistStoreError';
    this.status = status;
    this.operation = operation;
  }
}

function gistHttpError(operation: 'load' | 'save', status: number): GistStoreError {
  const verb = operation === 'load' ? 'leer' : 'guardar';
  if (status === 401 || status === 403)
    return new GistStoreError(
      `No se pudo ${verb} el gist de alertas (HTTP ${status}). ALERTS_GITHUB_TOKEN está vencido, revocado o sin el permiso gist. Crea un token clásico nuevo (solo scope gist; GitHub lo caduca a los 30 días si no eliges otra fecha) y sustitúyelo en Render. ALERTS_GIST_ID no cambia.`,
      status,
      operation,
    );
  if (status === 404)
    return new GistStoreError(
      `No se pudo ${verb} el gist de alertas (HTTP 404). ALERTS_GIST_ID no existe o el token no es de la cuenta dueña del gist.`,
      status,
      operation,
    );
  return new GistStoreError(
    `No se pudo ${verb} el gist de alertas (HTTP ${status}).`,
    status,
    operation,
  );
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

  private async request(operation: 'load' | 'save', init?: RequestInit): Promise<Response> {
    const verb = operation === 'load' ? 'leer' : 'guardar';
    let res: Response;
    try {
      res = await this.fetch(`https://api.github.com/gists/${this.gistId}`, {
        ...init,
        headers: this.headers(),
      });
    } catch (e) {
      throw new GistStoreError(
        `No se pudo ${verb} el gist de alertas: ${(e as Error).message}`,
        null,
        operation,
      );
    }
    if (!res.ok) throw gistHttpError(operation, res.status);
    return res;
  }

  async load(): Promise<AlertsState> {
    if (this.cache) return structuredClone(this.cache);
    const res = await this.request('load');
    const body = (await res.json().catch(() => null)) as {
      files?: Record<string, { content?: string }>;
    } | null;
    const content = body?.files?.['alerts.enc']?.content?.trim();
    if (!content) {
      this.cache = emptyState();
      return structuredClone(this.cache);
    }
    let json: string;
    try {
      json = decrypt(content, this.secret);
    } catch {
      throw new GistStoreError(
        'No se pudo leer el gist de alertas: el contenido no se descifra. La clave es TELEGRAM_BOT_TOKEN; si cambió, el estado cifrado anterior quedó ilegible.',
        null,
        'load',
      );
    }
    let parsed: AlertsState;
    try {
      parsed = JSON.parse(json) as AlertsState;
    } catch {
      throw new GistStoreError(
        'No se pudo leer el gist de alertas: el contenido descifrado no es JSON válido.',
        null,
        'load',
      );
    }
    if (!parsed || parsed.version !== 1 || !parsed.users || typeof parsed.users !== 'object')
      throw new GistStoreError(
        'No se pudo leer el gist de alertas: el estado no tiene la forma esperada.',
        null,
        'load',
      );
    this.cache = parsed;
    return structuredClone(this.cache);
  }

  async save(state: AlertsState): Promise<void> {
    await this.request('save', {
      method: 'PATCH',
      body: JSON.stringify({
        files: { 'alerts.enc': { content: encrypt(JSON.stringify(state), this.secret) } },
      }),
    });
    this.cache = structuredClone(state);
  }
}

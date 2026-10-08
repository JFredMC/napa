import type { CategoryId, Offer } from '@napa/deals-engine';

/**
 * - `live`: adaptador real contra una API pública u oficial (solo corre en el backend).
 * - `simulated`: datos ficticios generados en el código. Nunca son precios reales.
 */
export type ConnectorKind = 'live' | 'simulated';

export interface SearchQuery {
  /** Texto libre; vacío = ofertas destacadas. */
  q: string;
  category?: CategoryId;
  limit?: number;
}

/** Interfaz común: un adaptador por tienda. */
export interface StoreConnector {
  readonly storeId: string;
  readonly kind: ConnectorKind;
  search(query: SearchQuery, signal?: AbortSignal): Promise<Offer[]>;
}

/** Error de una fuente real (HTTP, bloqueo por robots.txt, falta de credenciales…). */
export class ConnectorError extends Error {
  constructor(
    readonly storeId: string,
    readonly code: 'http' | 'forbidden' | 'robots' | 'no-credentials' | 'timeout' | 'parse',
    message: string,
  ) {
    super(message);
    this.name = 'ConnectorError';
  }
}

/** `fetch` inyectable para probar los adaptadores reales sin red. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

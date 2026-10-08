import { createSimulatedConnector } from '../simulated-connector';
import type { StoreProfile } from '../generator';

/**
 * SIMULADO: Tienda de descuento: precio bajo todos los días, casi sin promos.
 * Datos ficticios generados en el navegador; nunca son precios reales de D1.
 */
export const d1Profile: StoreProfile = {
  factor: 0.86,
  spread: 0.03,
  promoRate: 0.1,
  inflatedRate: 0.02,
  maxPromo: 0.15,
};

export const d1Simulated = (clock?: () => string) =>
  createSimulatedConnector('d1', d1Profile, clock);

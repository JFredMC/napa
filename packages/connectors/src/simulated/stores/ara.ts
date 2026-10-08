import { createSimulatedConnector } from '../simulated-connector';
import type { StoreProfile } from '../generator';

/**
 * SIMULADO: Tienda de descuento: precio bajo y pocas promos.
 * Datos ficticios generados en el navegador; nunca son precios reales de Ara.
 */
export const araProfile: StoreProfile = {
  factor: 0.88,
  spread: 0.03,
  promoRate: 0.12,
  inflatedRate: 0.02,
  maxPromo: 0.18,
};

export const araSimulated = (clock?: () => string) =>
  createSimulatedConnector('ara', araProfile, clock);

import { createSimulatedConnector } from '../simulated-connector';
import type { StoreProfile } from '../generator';

/**
 * SIMULADO: Supermercado premium: algo más caro, promos moderadas.
 * Datos ficticios generados en el navegador; nunca son precios reales de Carulla.
 */
export const carullaProfile: StoreProfile = {
  factor: 1.08,
  spread: 0.04,
  promoRate: 0.25,
  inflatedRate: 0.06,
  maxPromo: 0.3,
};

export const carullaSimulated = (clock?: () => string) =>
  createSimulatedConnector('carulla', carullaProfile, clock);

import { createSimulatedConnector } from '../simulated-connector';
import type { StoreProfile } from '../generator';

/**
 * SIMULADO: Supermercado regional: algo más barato, promos frecuentes.
 * Datos ficticios generados en el navegador; nunca son precios reales de Olímpica.
 */
export const olimpicaProfile: StoreProfile = {
  factor: 0.97,
  spread: 0.04,
  promoRate: 0.3,
  inflatedRate: 0.1,
  maxPromo: 0.35,
};

export const olimpicaSimulated = (clock?: () => string) =>
  createSimulatedConnector('olimpica', olimpicaProfile, clock);

import { createSimulatedConnector } from '../simulated-connector';
import type { StoreProfile } from '../generator';

/**
 * SIMULADO: Moda internacional: muy barato, envío lento y tachados enormes que casi nunca se cobraron.
 * Datos ficticios generados en el navegador; nunca son precios reales de Shein.
 */
export const sheinProfile: StoreProfile = {
  factor: 0.55,
  spread: 0.12,
  promoRate: 0.3,
  inflatedRate: 0.45,
  maxPromo: 0.5,
};

export const sheinSimulated = (clock?: () => string) =>
  createSimulatedConnector('shein', sheinProfile, clock);

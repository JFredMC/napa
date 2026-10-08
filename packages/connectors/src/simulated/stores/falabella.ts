import { createSimulatedConnector } from '../simulated-connector';
import type { StoreProfile } from '../generator';

/**
 * SIMULADO: Tienda por departamentos: muchos eventos de descuento, varios con el precio "antes" inflado.
 * Datos ficticios generados en el navegador; nunca son precios reales de Falabella.
 */
export const falabellaProfile: StoreProfile = {
  factor: 1.02,
  spread: 0.06,
  promoRate: 0.35,
  inflatedRate: 0.2,
  maxPromo: 0.4,
};

export const falabellaSimulated = (clock?: () => string) =>
  createSimulatedConnector('falabella', falabellaProfile, clock);

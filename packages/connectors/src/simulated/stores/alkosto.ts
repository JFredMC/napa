import { createSimulatedConnector } from '../simulated-connector';
import type { StoreProfile } from '../generator';

/**
 * SIMULADO: Tecnología y hogar: precios competitivos y promos de temporada.
 * Datos ficticios generados en el navegador; nunca son precios reales de Alkosto.
 */
export const alkostoProfile: StoreProfile = { factor: 0.95, spread: 0.05, promoRate: 0.3, inflatedRate: 0.12, maxPromo: 0.3 };

export const alkostoSimulated = (clock?: () => string) => createSimulatedConnector('alkosto', alkostoProfile, clock);

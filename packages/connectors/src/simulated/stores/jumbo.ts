import { createSimulatedConnector } from '../simulated-connector';
import type { StoreProfile } from '../generator';

/**
 * SIMULADO: Hipermercado: precios parecidos al Éxito, promos frecuentes.
 * Datos ficticios generados en el navegador; nunca son precios reales de Jumbo.
 */
export const jumboProfile: StoreProfile = { factor: 0.99, spread: 0.04, promoRate: 0.3, inflatedRate: 0.1, maxPromo: 0.35 };

export const jumboSimulated = (clock?: () => string) => createSimulatedConnector('jumbo', jumboProfile, clock);

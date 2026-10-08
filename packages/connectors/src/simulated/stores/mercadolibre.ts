import { createSimulatedConnector } from '../simulated-connector';
import type { StoreProfile } from '../generator';

/**
 * SIMULADO: Marketplace: precios algo más bajos y dispersos (muchos vendedores), promos frecuentes y algunos tachados inflados.
 * Datos ficticios generados en el navegador; nunca son precios reales de Mercado Libre.
 */
export const mercadoLibreProfile: StoreProfile = { factor: 0.95, spread: 0.08, promoRate: 0.3, inflatedRate: 0.2, maxPromo: 0.35 };

export const mercadoLibreSimulated = (clock?: () => string) => createSimulatedConnector('mercadolibre', mercadoLibreProfile, clock);

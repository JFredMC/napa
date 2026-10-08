import { createSimulatedConnector } from '../simulated-connector';
import type { StoreProfile } from '../generator';

/**
 * SIMULADO: Supermercado grande: precio de referencia, promos semanales y pocos tachados inflados.
 * Datos ficticios generados en el navegador; nunca son precios reales de Éxito.
 */
export const exitoProfile: StoreProfile = { factor: 1.0, spread: 0.04, promoRate: 0.3, inflatedRate: 0.08, maxPromo: 0.35 };

export const exitoSimulated = (clock?: () => string) => createSimulatedConnector('exito', exitoProfile, clock);

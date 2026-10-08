import { createSimulatedConnector } from '../simulated-connector';
import type { StoreProfile } from '../generator';

/**
 * SIMULADO: Marketplace internacional: muy barato, envío de 1–2 semanas y "descuentos" de 60–80 % sobre precios inventados.
 * Datos ficticios generados en el navegador; nunca son precios reales de Temu.
 */
export const temuProfile: StoreProfile = { factor: 0.5, spread: 0.15, promoRate: 0.25, inflatedRate: 0.55, maxPromo: 0.5 };

export const temuSimulated = (clock?: () => string) => createSimulatedConnector('temu', temuProfile, clock);

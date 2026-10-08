import type { Shipping } from './types';

/** Costo de envío para un subtotal (0 si supera el umbral de envío gratis). */
export function shippingFor(shipping: Shipping | undefined, subtotal: number): number {
  if (!shipping) return 0;
  if (shipping.freeFrom !== undefined && subtotal >= shipping.freeFrom) return 0;
  return shipping.cost;
}

export function shippingLabel(shipping: Shipping): string {
  const days =
    shipping.minDays === shipping.maxDays
      ? shipping.minDays === 0
        ? 'hoy'
        : `${shipping.minDays} ${shipping.minDays === 1 ? 'día' : 'días'}`
      : `${shipping.minDays}–${shipping.maxDays} días`;
  return days;
}

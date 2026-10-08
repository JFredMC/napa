import type { Offer, PricePoint } from '@napa/deals-engine';

/**
 * Historial observado de las fuentes reales: guarda un precio por oferta y por día en memoria.
 * Con el backend corriendo varias semanas, la detección de descuentos inflados funciona también
 * para precios reales (sin persistencia: se reinicia con el proceso).
 */
export class PriceLog {
  private readonly points = new Map<string, PricePoint[]>();

  constructor(private readonly maxDays = 120) {}

  record(offer: Offer): Offer {
    const date = offer.observedAt.slice(0, 10);
    const list = this.points.get(offer.id) ?? [];
    const point = { date, price: offer.price, listPrice: offer.listPrice };
    if (list.at(-1)?.date === date) list[list.length - 1] = point;
    else list.push(point);
    if (list.length > this.maxDays) list.splice(0, list.length - this.maxDays);
    this.points.set(offer.id, list);
    return { ...offer, history: [...list] };
  }
}

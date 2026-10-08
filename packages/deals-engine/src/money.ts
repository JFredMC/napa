/** Porcentaje de descuento entero de `price` frente a `reference` (0 si no hay rebaja). */
export function discountPct(price: number, reference: number): number {
  if (!(reference > 0) || !(price >= 0) || price >= reference) return 0;
  return Math.round((1 - price / reference) * 100);
}

/** Diferencia con signo en porcentaje (negativo = más caro que la referencia). */
export function deltaPct(price: number, reference: number): number {
  if (!(reference > 0)) return 0;
  return Math.round((1 - price / reference) * 1000) / 10;
}

/** Ahorro en COP frente al precio "antes" (nunca negativo). */
export function savings(price: number, listPrice: number): number {
  return Math.max(0, Math.round(listPrice - price));
}

export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

export function median(values: readonly number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const hi = sorted[mid] ?? 0;
  return sorted.length % 2 ? hi : ((sorted[mid - 1] ?? hi) + hi) / 2;
}

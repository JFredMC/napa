import type { PricePoint } from './types';
import { median } from './money';

const DAY = 86_400_000;

function dayIndex(date: string): number {
  return Math.floor(Date.parse(`${date}T00:00:00Z`) / DAY);
}

/** Puntos con fecha en [hoy - from, hoy - to] días (from > to), relativo al último punto. */
export function window(history: readonly PricePoint[], from: number, to = 0): PricePoint[] {
  const last = history.at(-1);
  if (!last) return [];
  const today = dayIndex(last.date);
  return history.filter((p) => {
    const age = today - dayIndex(p.date);
    return age <= from && age >= to;
  });
}

export interface HistoryStats {
  /** Días cubiertos por el historial. */
  days: number;
  current: number;
  min30: number;
  min90: number;
  max90: number;
  median30: number;
  median90: number;
  /** Precio habitual antes de la promo: mediana de hace 90 a 8 días. */
  usual: number;
  /** Precio más alto cobrado de hace 90 a 8 días. */
  maxBefore: number;
  /** ¿El precio actual es el más bajo de 90 días? */
  isLowest90: boolean;
  /** Variación frente a hace 30 días, en %. */
  change30: number;
}

export function historyStats(history: readonly PricePoint[]): HistoryStats | null {
  const last = history.at(-1);
  const first = history[0];
  if (!last || !first) return null;
  const p30 = window(history, 30).map((p) => p.price);
  const p90 = window(history, 90).map((p) => p.price);
  const before = window(history, 90, 8).map((p) => p.price);
  const ago30 = window(history, 31, 29)[0]?.price ?? first.price;
  const min90 = Math.min(...p90);
  return {
    days: dayIndex(last.date) - dayIndex(first.date) + 1,
    current: last.price,
    min30: Math.min(...p30),
    min90,
    max90: Math.max(...p90),
    median30: median(p30),
    median90: median(p90),
    usual: before.length ? median(before) : median(p90),
    maxBefore: before.length ? Math.max(...before) : last.price,
    isLowest90: last.price <= min90,
    change30: ago30 > 0 ? Math.round((last.price / ago30 - 1) * 1000) / 10 : 0,
  };
}

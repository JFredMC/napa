import type { CategoryId, UnitPrice } from '@napa/deals-engine';

/** $4.300, $1.899.900 */
export function cop(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const sign = n < 0 ? '−' : '';
  return `${sign}$${Math.round(Math.abs(n)).toLocaleString('es-CO')}`;
}

/** $1,9 M · $350 mil · $4.300 */
export function copShort(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000)
    return `$${(n / 1_000_000).toLocaleString('es-CO', { maximumFractionDigits: 1 })} M`;
  if (a >= 100_000) return `$${Math.round(n / 1000).toLocaleString('es-CO')} mil`;
  return cop(n);
}

export function pct(n: number | null | undefined, decimals = 0): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return `${n.toLocaleString('es-CO', { maximumFractionDigits: decimals, minimumFractionDigits: 0 })} %`;
}

export function unitLabel(u: UnitPrice | null): string {
  return u ? `${cop(u.value)} / ${u.per}` : '';
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "7 oct" a partir de AAAA-MM-DD. */
export function shortDate(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split('-').map(Number);
  return m && d ? `${d} ${MONTHS[m - 1]}` : iso;
}

export function km(n: number): string {
  return n < 1
    ? `${Math.round(n * 1000)} m`
    : `${n.toLocaleString('es-CO', { maximumFractionDigits: 1 })} km`;
}

export const CATEGORY_ICON: Record<CategoryId, string> = {
  despensa: 'bi-basket2',
  lacteos: 'bi-egg-fried',
  bebidas: 'bi-cup-straw',
  'aseo-hogar': 'bi-droplet-half',
  'cuidado-personal': 'bi-person-heart',
  bebe: 'bi-balloon-heart',
  mascotas: 'bi-heart',
  tecnologia: 'bi-phone',
  electrohogar: 'bi-plug',
  hogar: 'bi-lamp',
  moda: 'bi-bag-heart',
  belleza: 'bi-brush',
};

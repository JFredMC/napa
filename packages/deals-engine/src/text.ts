/** Minúsculas, sin tildes y con espacios simples. */
export function norm(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9.,×x ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP = new Set([
  'de',
  'del',
  'la',
  'el',
  'los',
  'las',
  'y',
  'en',
  'con',
  'para',
  'por',
  'un',
  'una',
  'x',
  'und',
  'unds',
  'unidades',
  'g',
  'gr',
  'grs',
  'kg',
  'ml',
  'l',
  'lt',
  'cc',
  'pack',
  'paca',
]);

/** Palabras significativas (sin conectores ni unidades). */
export function tokens(value: string): string[] {
  return norm(value)
    .split(' ')
    .map((w) => w.replace(/[.,]+$/g, ''))
    .filter((w) => w.length > 1 && !STOP.has(w) && !/^\d+([.,]\d+)?$/.test(w));
}

/** ¿Todas las palabras de la búsqueda aparecen (como prefijo) en el texto? */
export function matchesQuery(text: string, query: string): boolean {
  const needles = tokens(query);
  if (!needles.length) return true;
  const hay = tokens(text);
  return needles.every((n) => hay.some((h) => h.startsWith(n) || (n.length > 4 && h.includes(n))));
}

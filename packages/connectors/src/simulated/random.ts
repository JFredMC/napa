/** Hash FNV-1a de 32 bits: la misma semilla da siempre los mismos datos. */
export function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** PRNG mulberry32 sembrado: devuelve números en [0, 1). */
export function seeded(seed: string): () => number {
  let a = hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function between(rng: () => number, min: number, max: number): number {
  return min + (max - min) * rng();
}

/** Redondea como en las góndolas colombianas: $4.350, $27.900, $1.899.900. */
export function shelfPrice(n: number): number {
  if (n >= 1_000_000) return Math.max(1_000_000, Math.round(n / 10_000) * 10_000 - 100);
  if (n >= 20_000) return Math.round(n / 1000) * 1000 - 100;
  return Math.max(50, Math.round(n / 50) * 50);
}

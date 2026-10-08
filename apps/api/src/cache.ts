/** Caché en memoria con vencimiento y tamaño máximo (descarta lo más viejo). */
export class TtlCache<T> {
  private readonly map = new Map<string, { at: number; value: T }>();

  constructor(
    private readonly ttlMs: number,
    private readonly max = 500,
    private readonly now: () => number = () => Date.now(),
  ) {}

  get(key: string): T | undefined {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (this.now() - hit.at > this.ttlMs) {
      this.map.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: T): void {
    this.map.delete(key);
    this.map.set(key, { at: this.now(), value });
    while (this.map.size > this.max) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  get size(): number {
    return this.map.size;
  }
}

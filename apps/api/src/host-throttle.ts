/**
 * Límite de ritmo hacia cada tienda: las peticiones a un mismo dominio salen en fila y con una
 * separación mínima, sin importar cuántos usuarios busquen a la vez.
 */
export class HostThrottle {
  private readonly tails = new Map<string, Promise<unknown>>();
  private readonly last = new Map<string, number>();

  constructor(
    private readonly intervalMs: number,
    private readonly now: () => number = () => Date.now(),
    private readonly sleep: (ms: number) => Promise<void> = (ms) =>
      new Promise((r) => setTimeout(r, ms)),
  ) {}

  run<T>(host: string, task: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(host) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(async () => {
        const wait = (this.last.get(host) ?? -Infinity) + this.intervalMs - this.now();
        if (wait > 0) await this.sleep(wait);
        this.last.set(host, this.now());
        return task();
      });
    this.tails.set(host, next);
    return next;
  }
}

import { TtlCache } from './cache';
import { HostThrottle } from './host-throttle';
import { PriceLog } from './price-log';

describe('TtlCache', () => {
  it('vence y respeta el tamaño máximo', () => {
    let now = 0;
    const c = new TtlCache<number>(1000, 2, () => now);
    c.set('a', 1);
    c.set('b', 2);
    c.set('c', 3);
    expect(c.get('a')).toBeUndefined();
    expect(c.get('b')).toBe(2);
    now = 1001;
    expect(c.get('b')).toBeUndefined();
    expect(c.size).toBe(1);
  });
});

describe('HostThrottle', () => {
  it('separa las peticiones al mismo dominio y no bloquea otros', async () => {
    let now = 0;
    const waits: number[] = [];
    const t = new HostThrottle(
      1500,
      () => now,
      async (ms) => {
        waits.push(ms);
        now += ms;
      },
    );
    const order: string[] = [];
    await Promise.all([
      t.run('a.co', async () => order.push('a1')),
      t.run('a.co', async () => order.push('a2')),
      t.run('b.co', async () => order.push('b1')),
    ]);
    expect(order).toEqual(['a1', 'b1', 'a2']);
    expect(waits).toEqual([1500]);
  });
  it('un error no traba la fila', async () => {
    const t = new HostThrottle(0);
    await expect(t.run('a', async () => Promise.reject(new Error('x')))).rejects.toThrow('x');
    await expect(t.run('a', async () => 1)).resolves.toBe(1);
  });
});

describe('PriceLog', () => {
  it('un punto por día', () => {
    const log = new PriceLog(2);
    const base = {
      id: 'x',
      productKey: 'x',
      storeId: 's',
      title: 't',
      brand: '',
      category: 'despensa' as const,
      listPrice: 10,
      source: 'live' as const,
    };
    log.record({ ...base, price: 10, observedAt: '2026-10-05T10:00:00Z' });
    log.record({ ...base, price: 9, observedAt: '2026-10-06T10:00:00Z' });
    log.record({ ...base, price: 8, observedAt: '2026-10-06T18:00:00Z' });
    const o = log.record({ ...base, price: 7, observedAt: '2026-10-07T10:00:00Z' });
    expect(o.history!.map((p) => [p.date, p.price])).toEqual([
      ['2026-10-06', 8],
      ['2026-10-07', 7],
    ]);
  });
});

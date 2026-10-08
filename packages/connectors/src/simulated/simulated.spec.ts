import { analyzeDiscount, type Offer } from '@napa/deals-engine';
import { describe, expect, it } from 'vitest';
import { STORES, STORE_IDS, BRAND_RULES } from '../stores';
import { CATALOG } from './catalog';
import { HISTORY_DAYS, simulateStore, todayInBogota } from './generator';
import { shelfPrice } from './random';
import { SIMULATED_PROFILES, simulatedConnectors } from './stores/index';

const DAY = '2026-10-07';
const all = (): Offer[] =>
  STORE_IDS.flatMap((id) => simulateStore(id, SIMULATED_PROFILES[id]!, DAY));

describe('tiendas simuladas', () => {
  it('un adaptador simulado por tienda, todos marcados como simulados', async () => {
    const conns = simulatedConnectors(() => DAY);
    expect(conns.map((c) => c.storeId).sort()).toEqual([...STORE_IDS].sort());
    for (const c of conns) {
      expect(c.kind).toBe('simulated');
      const offers = await c.search({ q: '' });
      expect(offers.length).toBeGreaterThan(5);
      expect(offers.every((o) => o.source === 'simulated')).toBe(true);
    }
  });

  it('determinista: misma tienda y día, mismos precios', () => {
    expect(simulateStore('exito', SIMULATED_PROFILES['exito']!, DAY)).toEqual(
      simulateStore('exito', SIMULATED_PROFILES['exito']!, DAY),
    );
  });

  it('historial de 120 días que termina hoy y coincide con el precio actual', () => {
    for (const o of all()) {
      expect(o.history).toHaveLength(HISTORY_DAYS);
      expect(o.history!.at(-1)!.date).toBe(DAY);
      expect(o.history!.at(-1)!.price).toBe(o.price);
      expect(o.listPrice).toBeGreaterThanOrEqual(o.price);
    }
  });

  it('cada producto existe en al menos dos tiendas (para comparar)', () => {
    const offers = all();
    for (const t of CATALOG) {
      expect(
        new Set(offers.filter((o) => o.productKey === t.key).map((o) => o.storeId)).size,
        t.key,
      ).toBeGreaterThanOrEqual(2);
    }
  });

  it('mezcla realista: hay descuentos reales, inflados y precios normales', () => {
    const verdicts = all().map((o) => analyzeDiscount(o).verdict);
    const count = (v: string) => verdicts.filter((x) => x === v).length;
    expect(count('inflado')).toBeGreaterThan(20);
    expect(count('real') + count('minimo')).toBeGreaterThan(40);
    expect(count('sin-descuento')).toBeGreaterThan(60);
  });

  it('Temu y Shein inflan más que el Éxito; D1 es más barato que Carulla', () => {
    const rate = (store: string) => {
      const offers = simulateStore(store, SIMULATED_PROFILES[store]!, DAY).filter(
        (o) => o.listPrice > o.price,
      );
      return (
        offers.filter((o) => analyzeDiscount(o).verdict === 'inflado').length /
        Math.max(offers.length, 1)
      );
    };
    expect(rate('temu')).toBeGreaterThan(rate('exito'));
    const avg = (store: string, keys: Set<string>) => {
      const offers = simulateStore(store, SIMULATED_PROFILES[store]!, DAY).filter((o) =>
        keys.has(o.productKey),
      );
      return (
        offers.reduce(
          (s, o) => s + o.history!.reduce((t, p) => t + p.price, 0) / o.history!.length,
          0,
        ) / offers.length
      );
    };
    const shared = new Set(
      simulateStore('d1', SIMULATED_PROFILES['d1']!, DAY)
        .map((o) => o.productKey)
        .filter((k) =>
          simulateStore('carulla', SIMULATED_PROFILES['carulla']!, DAY).some(
            (o) => o.productKey === k,
          ),
        ),
    );
    expect(avg('d1', shared)).toBeLessThan(avg('carulla', shared) * 0.9);
  });

  it('busca por texto y categoría', async () => {
    const [ml] = simulatedConnectors(() => DAY);
    expect((await ml!.search({ q: 'freidora' })).map((o) => o.productKey)).toEqual(['freidora-5l']);
    expect(await ml!.search({ q: '', category: 'moda', limit: 2 })).toHaveLength(2);
  });

  it('precios de góndola y fecha de Bogotá', () => {
    expect(shelfPrice(4321)).toBe(4300);
    expect(shelfPrice(27_640)).toBe(27_900);
    expect(shelfPrice(1_903_000)).toBe(1_899_900);
    expect(todayInBogota(new Date('2026-10-08T03:00:00Z'))).toBe('2026-10-07');
  });

  it('metadatos: cada tienda dice por qué es real o simulada', () => {
    for (const s of Object.values(STORES)) expect(s.sourceNote.length).toBeGreaterThan(30);
    expect(BRAND_RULES.map((r) => r.storeId)).toContain('d1');
    expect(BRAND_RULES.map((r) => r.storeId)).not.toContain('temu');
  });
});

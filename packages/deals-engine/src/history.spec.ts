import { describe, expect, it } from 'vitest';
import { historyStats, window } from './history';
import { history } from './testing';

describe('historial', () => {
  const h = history(120, (ago) => (ago < 5 ? 8000 : ago < 40 ? 10000 : 11000));

  it('ventanas relativas al último punto', () => {
    expect(window(h, 4)).toHaveLength(5);
    expect(window(h, 90, 8)).toHaveLength(83);
    expect(window([], 30)).toEqual([]);
  });

  it('estadísticas', () => {
    const s = historyStats(h)!;
    expect(s.days).toBe(120);
    expect(s.current).toBe(8000);
    expect(s.min90).toBe(8000);
    expect(s.max90).toBe(11000);
    expect(s.usual).toBe(11000);
    expect(s.maxBefore).toBe(11000);
    expect(s.isLowest90).toBe(true);
    expect(s.change30).toBe(-20);
    expect(historyStats([])).toBeNull();
  });
});

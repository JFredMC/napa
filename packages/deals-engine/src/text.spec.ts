import { describe, expect, it } from 'vitest';
import { matchesQuery, norm, tokens } from './text';

describe('texto', () => {
  it('normaliza tildes y mayúsculas', () => {
    expect(norm('  Atún  en ACEITE, Pañales ')).toBe('atun en aceite, panales');
  });
  it('tokens sin conectores, unidades ni números', () => {
    expect(tokens('Arroz blanco de 1 kg x 6')).toEqual(['arroz', 'blanco']);
  });
  it('busca por prefijo y sin tildes', () => {
    expect(matchesQuery('Atún en agua La Sirena 160 g', 'atun agua')).toBe(true);
    expect(matchesQuery('Audífonos inalámbricos', 'audif')).toBe(true);
    expect(matchesQuery('Arroz blanco', 'atun')).toBe(false);
    expect(matchesQuery('cualquier cosa', '  ')).toBe(true);
  });
});

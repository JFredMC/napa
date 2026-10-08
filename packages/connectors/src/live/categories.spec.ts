import { describe, expect, it } from 'vitest';
import { mapCategory } from './categories';

describe('categorías', () => {
  it('usa la categoría más específica', () => {
    expect(
      mapCategory(['/Supermercado/Despensa/Enlatados/', '/Supermercado/'], 'Atún en agua 160 g'),
    ).toBe('despensa');
    expect(mapCategory(['/Supermercado/Lácteos/Leches/'])).toBe('lacteos');
    expect(mapCategory(['/Tecnología/Celulares/'])).toBe('tecnologia');
    expect(mapCategory(['/Supermercado/'], 'Concentrado para perro 8 kg')).toBe('mascotas');
    expect(mapCategory([], 'Algo raro')).toBe('despensa');
  });
});

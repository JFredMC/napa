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

  it('no confunde palabras sueltas (casos reales de Jumbo y Olímpica)', () => {
    expect(
      mapCategory(
        ['/Salud Y Bienestar/Droguería/Gripa Y Tos/', '/Salud Y Bienestar/'],
        'Dolex Forte Oferta Pague 17 Lleve 20 Tabletas',
      ),
    ).toBe('cuidado-personal');
    expect(mapCategory([], 'Filete de Basa Oferta')).toBe('despensa');
    expect(mapCategory([], 'Aguacate Hass x 3')).toBe('despensa');
    expect(mapCategory([], 'Té verde x 20 sobres')).toBe('bebidas');
    expect(mapCategory(['/Libros Y Papelería/Escritura/'], 'Sharpie Twin Tip x8')).toBe('hogar');
    expect(mapCategory([], 'Concentrado para perro sabor pollo')).toBe('mascotas');
  });
});

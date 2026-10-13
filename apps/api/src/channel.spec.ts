import { absurdUnitPrice, matchesTerm, searchTerms } from './channel';

describe('matchesTerm', () => {
  it('acepta el producto y rechaza lo que solo menciona el término', () => {
    expect(matchesTerm('Arroz Roa x1kg', 'arroz')).toBe(true);
    expect(matchesTerm('Lomo de Atún Pesco 400 G', 'atun')).toBe(true);
    expect(matchesTerm('Pañales Huggies Etapa 3', 'panales')).toBe(true);
    expect(matchesTerm('Extractor De Leche Electrico Doble', 'leche')).toBe(false);
    expect(matchesTerm('Camion Dino Café', 'cafe')).toBe(false);
    expect(matchesTerm('Organizador De Cuna Para Pañales', 'panales')).toBe(false);
  });
  it('searchTerms toma las tres primeras palabras', () => {
    expect(searchTerms('Arroz Roa x1kg premium')).toBe('Arroz Roa x1kg');
  });
});

describe('absurdUnitPrice', () => {
  it('descarta precios por kilo imposibles', () => {
    expect(absurdUnitPrice({ price: 97015, size: { amount: 200, unit: 'g' } })).toBe(true);
    expect(absurdUnitPrice({ price: 4890, size: { amount: 1000, unit: 'g' } })).toBe(false);
    expect(absurdUnitPrice({ price: 97015 })).toBe(false);
  });
});

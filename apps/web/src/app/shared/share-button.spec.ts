import { shareText, whatsappUrl } from './share-button';

describe('compartir', () => {
  it('arma un mensaje corto en español con precio y enlace', () => {
    const t = shareText('Arroz Roa 1kg', 4890, 'Jumbo', 'https://napaofertas.com/producto/jumbo-1');
    expect(t).toBe(
      'Mira este precio en Ñapa: Arroz Roa 1kg a $4.890 en Jumbo. Compara tiendas aquí: https://napaofertas.com/producto/jumbo-1',
    );
    expect(whatsappUrl(t)).toMatch(/^https:\/\/wa\.me\/\?text=Mira%20este/);
  });
});

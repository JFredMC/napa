import { loadConfig } from './config';

describe('config', () => {
  it('valores por defecto seguros', () => {
    const c = loadConfig({});
    expect(c.port).toBe(3000);
    expect(c.liveStores).toEqual(['jumbo', 'olimpica', 'exito', 'carulla']);
    expect(c.userAgent).toMatch(/^NapaBot\/.+github\.com\/JFredMC\/napa/);
    expect(c.mercadoLibre).toBeNull();
    expect(c.clientRpm).toBe(60);
  });
  it('lee variables y exige las tres credenciales de Mercado Libre', () => {
    const c = loadConfig({
      PORT: '8080',
      LIVE_STORES: ' jumbo , ',
      CORS_ORIGINS: 'https://a.co',
      ML_CLIENT_ID: 'i',
      ML_CLIENT_SECRET: 's',
    });
    expect(c.port).toBe(8080);
    expect(c.liveStores).toEqual(['jumbo']);
    expect(c.corsOrigins).toEqual(['https://a.co']);
    expect(c.mercadoLibre).toBeNull();
    expect(
      loadConfig({ ML_CLIENT_ID: 'i', ML_CLIENT_SECRET: 's', ML_REFRESH_TOKEN: 'r' }).mercadoLibre,
    ).toEqual({ clientId: 'i', clientSecret: 's', refreshToken: 'r' });
  });
});

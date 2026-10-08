import { describe, expect, it } from 'vitest';
import { affiliateRulesFromEnv, storeSearchUrl, withAffiliate } from './links';

describe('enlaces de salida', () => {
  it('sin regla: directo a la tienda, sin afiliado', () => {
    expect(withAffiliate('https://www.jumbocolombia.com/arroz/p', undefined)).toEqual({
      href: 'https://www.jumbocolombia.com/arroz/p',
      affiliate: false,
    });
  });

  it('plantilla de deeplink (Admitad / Awin)', () => {
    const r = withAffiliate(
      'https://www.shein.com.co/vestido-p-1.html?x=1',
      'https://ad.admitad.com/g/abc/?ulp={url}',
    );
    expect(r.affiliate).toBe(true);
    expect(r.href).toBe(
      'https://ad.admitad.com/g/abc/?ulp=https%3A%2F%2Fwww.shein.com.co%2Fvestido-p-1.html%3Fx%3D1',
    );
  });

  it('parámetros que se agregan a la URL', () => {
    const r = withAffiliate('https://articulo.mercadolibre.com.co/MCO-1?a=b', 'tag=napa&src=web');
    expect(r).toEqual({
      href: 'https://articulo.mercadolibre.com.co/MCO-1?a=b&tag=napa&src=web',
      affiliate: true,
    });
  });

  it('ignora reglas inválidas (plantilla sin {url}, http plano, URL relativa)', () => {
    expect(withAffiliate('https://x.co/p', 'https://ad.example/g/abc').affiliate).toBe(false);
    expect(withAffiliate('/relativa', 'tag=1').affiliate).toBe(false);
    expect(withAffiliate('https://x.co/p', '   ').affiliate).toBe(false);
  });

  it('búsquedas públicas por tienda', () => {
    expect(storeSearchUrl('exito', 'arroz diana')).toBe('https://www.exito.com/s?q=arroz%20diana');
    expect(storeSearchUrl('mercadolibre', 'Café Sello Rojo')).toBe(
      'https://listado.mercadolibre.com.co/cafe-sello-rojo',
    );
    expect(storeSearchUrl('ara', 'arroz', 'https://aratiendas.com')).toBe('https://aratiendas.com');
  });

  it('lee NAPA_AFF_<TIENDA>', () => {
    expect(
      affiliateRulesFromEnv({ NAPA_AFF_SHEIN: ' https://a/?u={url} ', NAPA_AFF_TEMU: '' }, [
        'shein',
        'temu',
      ]),
    ).toEqual({ shein: 'https://a/?u={url}' });
  });
});

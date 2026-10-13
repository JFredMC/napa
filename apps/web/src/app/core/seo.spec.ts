import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import type { Offer } from '@napa/deals-engine';
import { Seo } from './seo';
import { DEFAULT_SITE_CONFIG, SITE_CONFIG } from './site-config';

const offer = (over: Partial<Offer>): Offer =>
  ({
    id: 'jumbo-1',
    productKey: 'jumbo-1',
    storeId: 'jumbo',
    title: 'Arroz </script> Diana',
    brand: 'DIANA',
    category: 'despensa',
    price: 21900,
    listPrice: 23900,
    url: 'https://www.jumbocolombia.com/arroz-diana/p',
    source: 'live',
    observedAt: '2026-10-08T11:00:00.000Z',
    ...over,
  }) as Offer;

describe('Seo', () => {
  function setup() {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SITE_CONFIG,
          useValue: { ...DEFAULT_SITE_CONFIG, siteUrl: 'https://napa.test/' },
        },
      ],
    });
    return { seo: TestBed.inject(Seo), doc: TestBed.inject(DOCUMENT) };
  }

  it('título, descripción, canónica, Open Graph y robots', () => {
    const { seo, doc } = setup();
    seo.set({ title: 'T', description: 'D', path: 'categoria/despensa' });
    expect(doc.title).toBe('T');
    const meta = (sel: string) => doc.head.querySelector(sel)?.getAttribute('content');
    expect(meta('meta[name="description"]')).toBe('D');
    expect(meta('meta[property="og:url"]')).toBe('https://napa.test/categoria/despensa');
    expect(meta('meta[property="og:image"]')).toBe('https://napa.test/og.jpg');
    expect(meta('meta[name="robots"]')).toContain('index');
    expect(doc.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://napa.test/categoria/despensa',
    );
    seo.set({ title: 'T2', description: 'D2', path: '', noindex: true });
    expect(meta('meta[name="robots"]')).toBe('noindex, follow');
    expect(doc.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
  });

  it('JSON-LD de producto: solo precios reales, AggregateOffer en COP y sin romper <script>', () => {
    const { seo, doc } = setup();
    expect(seo.product([offer({ source: 'simulated' })])).toBeNull();
    const ld = seo.product([
      offer({}),
      offer({
        id: 'olimpica-1',
        storeId: 'olimpica',
        price: 20500,
        url: 'https://www.olimpica.com/a/p',
      }),
      offer({ id: 'd1-1', storeId: 'd1', price: 100, source: 'simulated' }),
    ]) as { '@type': string; offers: unknown };
    expect(ld['@type']).toBe('Product');
    expect(ld.offers).toMatchObject({
      '@type': 'AggregateOffer',
      priceCurrency: 'COP',
      lowPrice: 20500,
      highPrice: 21900,
      offerCount: 2,
    });
    seo.set({ title: 'T', description: 'D', path: 'producto/jumbo-1', jsonLd: [ld] });
    const script = doc.getElementById('napa-ld')!;
    expect(script.textContent).not.toContain('</script>');
    expect(JSON.parse(script.textContent!)['@graph'][0].name).toBe('Arroz </script> Diana');
    seo.set({ title: 'T', description: 'D', path: '' });
    expect(doc.getElementById('napa-ld')).toBeNull();
  });

  it('ItemList enlaza a las páginas de producto de Ñapa', () => {
    const { seo } = setup();
    const list = seo.itemList('Top', [offer({})]) as { itemListElement: unknown[] };
    expect(list.itemListElement[0]).toEqual({
      '@type': 'ListItem',
      position: 1,
      url: 'https://napa.test/producto/jumbo-1',
      name: 'Arroz </script> Diana',
    });
  });
});

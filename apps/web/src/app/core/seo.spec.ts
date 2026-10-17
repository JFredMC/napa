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

  it('JSON-LD de producto: imagen de otra tienda, stock 0, sin URL propia y validez vencida', () => {
    const { seo } = setup();
    const ld = seo.product([
      offer({ stock: 0, url: undefined, image: undefined, observedAt: '2020-01-01T00:00:00.000Z' }),
      offer({
        id: 'olimpica-1',
        storeId: 'olimpica',
        price: 20500,
        image: 'https://tienda.example/olimpica.jpg',
        observedAt: '2020-01-01T00:00:00.000Z',
      }),
    ]) as {
      description: string;
      image: string[];
      offers: { offers: Record<string, unknown>[] };
    };
    expect(ld.image).toEqual(['https://tienda.example/olimpica.jpg']);
    expect(ld.description).toContain('Arroz </script> Diana');
    expect(ld.description).toContain('$20.500');
    const [first, second] = ld.offers.offers;
    // Sin URL de la tienda, la oferta apunta a la ficha de Ñapa; el stock 0 no es InStock.
    expect(first!['url']).toBe('https://napa.test/producto/jumbo-1');
    expect(first!['sku']).toBe('jumbo-1');
    expect(first!['availability']).toBe('https://schema.org/OutOfStock');
    expect(second!['availability']).toBe('https://schema.org/InStock');
    // La foto vieja (2020/2026 frente a hoy) no promete priceValidUntil ya vencido.
    expect(first).not.toHaveProperty('priceValidUntil');
    expect(second).not.toHaveProperty('priceValidUntil');
  });

  it('JSON-LD de producto: priceValidUntil vigente se conserva', () => {
    const { seo } = setup();
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const ld = seo.product([offer({ observedAt: future })]) as {
      offers: Record<string, unknown>;
    };
    expect(typeof ld.offers['priceValidUntil']).toBe('string');
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

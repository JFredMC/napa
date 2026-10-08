import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { Offer } from '@napa/deals-engine';
import { AdSlot } from '../shared/ad-slot';
import { ConsentBanner } from '../shared/consent-banner';
import { StoreLink } from '../shared/store-link';
import { ConsentStore } from './consent.store';
import { API_URL } from './mode';
import { Outbound } from './outbound';
import { DEFAULT_SITE_CONFIG, SITE_CONFIG, type SiteConfig } from './site-config';

const LIVE: Offer = {
  id: 'jumbo-1',
  productKey: 'arroz-roa-5kg',
  storeId: 'jumbo',
  title: 'Arroz Roa x5kg',
  brand: 'ROA',
  category: 'despensa',
  price: 22670,
  listPrice: 22670,
  url: 'https://www.jumbocolombia.com/arroz-roa-x5kg/p',
  source: 'live',
  observedAt: '2026-10-08T15:00:00Z',
};
const SIM: Offer = {
  ...LIVE,
  id: 'shein-1',
  storeId: 'shein',
  source: 'simulated',
  url: undefined,
  title: 'Vestido midi',
};

function setup(config: Partial<SiteConfig> = {}) {
  localStorage.clear();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: API_URL, useValue: 'https://api.test' },
      { provide: SITE_CONFIG, useValue: { ...DEFAULT_SITE_CONFIG, ...config } },
    ],
  });
}

describe('Outbound', () => {
  it('oferta en vivo: ficha real con la regla de afiliado configurada', () => {
    setup({ affiliates: { jumbo: 'https://aff.test/?u={url}' } });
    const link = TestBed.inject(Outbound).forOffer(LIVE)!;
    expect(link).toMatchObject({ affiliate: true, kind: 'producto', storeId: 'jumbo' });
    expect(link.href).toBe(`https://aff.test/?u=${encodeURIComponent(LIVE.url!)}`);
  });

  it('oferta simulada: nunca una ficha inventada, sino la búsqueda pública de la tienda', () => {
    setup();
    expect(TestBed.inject(Outbound).forOffer(SIM)).toMatchObject({
      href: 'https://www.shein.com.co/pdsearch/Vestido%20midi/',
      affiliate: false,
      kind: 'busqueda',
    });
  });

  it('cuenta el clic con un beacon sin datos personales', () => {
    setup();
    const beacon = vi.fn(() => true);
    Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true });
    const out = TestBed.inject(Outbound);
    out.track(out.forOffer(LIVE)!);
    expect(beacon).toHaveBeenCalledWith(
      'https://api.test/api/click?store=jumbo&kind=producto&aff=0',
    );
  });
});

@Component({
  imports: [StoreLink, AdSlot, ConsentBanner],
  template: `<app-store-link [offer]="offer" /><app-ad-slot slot="feed" /><app-consent-banner />`,
})
class Host {
  offer = LIVE;
}

describe('enlaces, anuncios y consentimiento', () => {
  it('"Ir a la tienda": pestaña nueva y rel sponsored nofollow noopener; nota de afiliado', async () => {
    setup({ affiliates: { jumbo: 'ref=napa' } });
    const f = TestBed.createComponent(Host);
    await f.whenStable();
    const a: HTMLAnchorElement = f.nativeElement.querySelector('[data-testid="out-jumbo"]');
    expect(a.target).toBe('_blank');
    expect(a.rel).toBe('sponsored nofollow noopener');
    expect(a.href).toBe('https://www.jumbocolombia.com/arroz-roa-x5kg/p?ref=napa');
    expect(f.nativeElement.querySelector('[data-testid="aff-note"]')).not.toBeNull();
  });

  it('sin configuración: ni banner ni espacio publicitario', async () => {
    setup();
    const f = TestBed.createComponent(Host);
    await f.whenStable();
    expect(f.nativeElement.querySelector('[data-testid="consent-banner"]')).toBeNull();
    expect(f.nativeElement.querySelector('.ad-slot')).toBeNull();
  });

  it('con AdSense: pide consentimiento y el anuncio aparece solo al aceptarlo', async () => {
    setup({
      adsense: { client: 'ca-pub-1234567890123456', slots: { feed: '1234567890', product: null } },
    });
    const f = TestBed.createComponent(Host);
    await f.whenStable();
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelector('[data-testid="consent-banner"]')).not.toBeNull();
    expect(el.querySelector('.ad-slot')).toBeNull();

    (el.querySelector('[data-testid="consent-reject"]') as HTMLButtonElement).click();
    await f.whenStable();
    expect(el.querySelector('[data-testid="consent-banner"]')).toBeNull();
    expect(el.querySelector('.ad-slot')).toBeNull();
    expect(JSON.parse(localStorage.getItem('napa:consent')!)).toMatchObject({
      ads: false,
      analytics: false,
    });

    const consent = TestBed.inject(ConsentStore);
    consent.reload = vi.fn();
    consent.acceptAll();
    await f.whenStable();
    const ins = el.querySelector('ins.adsbygoogle')!;
    expect(ins.getAttribute('data-ad-client')).toBe('ca-pub-1234567890123456');
    expect(ins.getAttribute('data-ad-slot')).toBe('1234567890');
  });

  it('retirar el permiso recarga para descargar los scripts de terceros', () => {
    setup({ analytics: { goatcounter: 'napa', cloudflareToken: null } });
    const consent = TestBed.inject(ConsentStore);
    consent.reload = vi.fn();
    consent.acceptAll();
    expect(consent.reload).not.toHaveBeenCalled();
    consent.rejectAll();
    expect(consent.reload).toHaveBeenCalledTimes(1);
  });
});

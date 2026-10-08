import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { App } from './app';
import { routes } from './app.routes';
import { API_URL, MODE_PREFERENCE } from './core/mode';

describe('Ñapa', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes, withComponentInputBinding()),
        { provide: API_URL, useValue: null },
        { provide: MODE_PREFERENCE, useValue: 'demo' },
      ],
    });
  });

  it('avisa que los precios son simulados y firma con enlace al portafolio', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('.nav a')).toHaveLength(5);
    expect(el.querySelector('[data-testid="demo-banner"]')?.textContent).toContain('simulados');
    expect(el.querySelector('[data-testid="mode-api"]')).toBeNull();
    const brand = el.querySelector<HTMLAnchorElement>('[data-testid="brand"]')!;
    expect(brand.href).toBe('https://jfredmc.github.io/portfolio/');
    expect(brand.target).toBe('_blank');
    expect(brand.rel).toContain('noopener');
  });

  it('cada oferta lleva el distintivo de simulada', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/?q=arroz');
    await harness.fixture.whenStable();
    const el = harness.routeNativeElement!;
    const cards = el.querySelectorAll('[data-testid^="offer-"]');
    expect(cards.length).toBeGreaterThan(0);
    expect(el.querySelectorAll('[data-testid="tag-sim"]')).toHaveLength(cards.length);
    expect(el.querySelectorAll('[data-testid="tag-live"]')).toHaveLength(0);
  });

  it('compara el mismo producto en varias tiendas y marca la más barata', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/producto/arroz-5kg');
    await harness.fixture.whenStable();
    const el = harness.routeNativeElement!;
    expect(el.querySelector('[data-testid="product-title"]')?.textContent).toContain(
      'Arroz blanco 5 kg',
    );
    expect(el.querySelectorAll('[data-testid="compare-table"] tbody tr').length).toBeGreaterThan(3);
    expect(el.querySelectorAll('.best-tag')).toHaveLength(1);
    expect(el.querySelector('[data-testid="sim-note"]')).not.toBeNull();
  });

  it('la página de fuentes explica qué es real y qué es simulado', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/fuentes');
    const el = harness.routeNativeElement!;
    expect(el.querySelectorAll('[data-testid="sources-table"] tbody tr')).toHaveLength(11);
    expect(el.textContent).toContain('No hace scraping');
  });
});

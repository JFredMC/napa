import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from './test-base';

/** Sedes reales de OpenStreetMap alrededor de Chapinero (Bogotá) para no depender de Overpass. */
const OVERPASS = readFileSync(join(__dirname, 'fixtures', 'overpass-chapinero.json'), 'utf8');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e')) {
      localStorage.clear();
      // Estas pruebas cubren la demo; el modo API tiene las suyas (api.spec.ts).
      localStorage.setItem('napa:mode', 'demo');
      // El sitio real tiene analítica: se decide el consentimiento de antemano ("solo necesarias")
      // para que el banner no tape botones. Su propia prueba está más abajo.
      localStorage.setItem(
        'napa:consent',
        JSON.stringify({
          version: 1,
          analytics: false,
          ads: false,
          personalizedAds: false,
          decidedAt: '2026-10-13T00:00:00.000Z',
        }),
      );
      sessionStorage.setItem('e2e', '1');
    }
  });
  // Nunca tocar el servidor real desde estas pruebas.
  await page.route(/\/api\/(health|search|sources)/, (route) => route.abort());
  await page.route(/overpass/, (route) =>
    route.fulfill({ contentType: 'application/json', body: OVERPASS }),
  );
});

/** Navega por la barra superior (escritorio) o la barra inferior (móvil). */
async function go(page: Page, label: string): Promise<void> {
  await page
    .getByRole('link', { name: new RegExp(`^${label}(\\s|$)`) })
    .filter({ visible: true })
    .first()
    .click();
}

test('portada: aviso de demo y cada precio marcado como simulado', async ({ page }) => {
  await page.goto('');
  await expect(page.getByTestId('demo-banner')).toContainText('simulados');
  await expect(page.getByTestId('demo-banner')).toContainText('No son precios reales vigentes');
  const cards = page.getByTestId('top').locator('article');
  await expect(cards.first()).toBeVisible();
  const n = await cards.count();
  expect(n).toBeGreaterThan(3);
  await expect(page.getByTestId('top').getByTestId('tag-sim')).toHaveCount(n);
  await expect(page.getByTestId('tag-live')).toHaveCount(0);
  await expect(page.getByTestId('inflated-count')).not.toHaveText('0');
  // El top de hoy nunca recomienda descuentos inflados.
  await expect(page.getByTestId('top').getByTestId('verdict-inflado')).toHaveCount(0);
});

test('búsqueda y filtros quedan en la URL', async ({ page }) => {
  await page.goto('');
  await page.getByTestId('search').fill('arroz');
  await page.getByTestId('search').press('Enter');
  await expect(page).toHaveURL(/q=arroz/);
  await expect(page.getByTestId('results-count')).toContainText('para “arroz”');
  await expect(page.getByTestId('results').locator('article').first()).toContainText(/arroz/i);
  await page.getByTestId('all-stores').check();
  await expect(page).toHaveURL(/todas=1/);
  await page.getByTestId('honest').check();
  await expect(page).toHaveURL(/honestos=1/);
  await expect(page.getByTestId('results').getByTestId('verdict-inflado')).toHaveCount(0);
  await page.getByTestId('sort').selectOption('price');
  await expect(page).toHaveURL(/orden=price/);
  await page.reload();
  await expect(page.getByTestId('honest')).toBeChecked();
  await expect(page.getByTestId('search')).toHaveValue('arroz');
});

test('producto: compara tiendas, historial y análisis del descuento', async ({ page }) => {
  await page.goto('producto/arroz-5kg');
  await expect(page.getByTestId('product-title')).toHaveText('Arroz blanco 5 kg');
  await expect(page.getByTestId('sim-note')).toBeVisible();
  const rows = page.getByTestId('compare-table').locator('tbody tr');
  expect(await rows.count()).toBeGreaterThan(3);
  await expect(page.locator('.best-tag')).toHaveCount(1);
  await expect(page.getByTestId('price-chart')).toBeVisible();
  await expect(page.getByTestId('analysis')).toBeVisible();
  await expect(page.getByTestId('score-parts').locator('li')).toHaveCount(5);
  await page.getByTestId('row-d1').click();
  await expect(page).toHaveURL(/tienda=d1/);
  await expect(page.getByTestId('row-d1')).toHaveClass(/sel/);
});

test('alerta de precio y favoritos aparecen en Guardados', async ({ page }) => {
  await page.goto('producto/cafe-500');
  await page.getByTestId('fav').click();
  await expect(page.getByTestId('toast')).toContainText('favoritos');
  await page.getByTestId('target').fill('$99.999');
  await page.getByTestId('target').blur();
  await page.getByTestId('save-watch').click();
  await expect(page.getByTestId('toast')).toContainText('$99.999');
  await go(page, 'Guardados');
  await expect(page.getByTestId('favorites')).toContainText('Café molido');
  await page.getByTestId('tab-alertas').click();
  // El objetivo está por encima del precio de hoy: la alerta se cumple de inmediato.
  await expect(page.getByTestId('watch-cafe-500').getByTestId('triggered')).toBeVisible();
});

test('lista de compras: reparte entre tiendas y muestra el ahorro', async ({ page }) => {
  await page.goto('lista');
  await page.getByTestId('sample').click();
  await expect(page.getByTestId('lines').locator('li')).toHaveCount(11);
  await expect(page.getByTestId('plan-total')).toHaveText(/^\$\d{2,3}\.\d{3}$/);
  await expect(page.getByTestId('singles').locator('tr').first()).toBeVisible();
  await page.getByTestId('max-1').click();
  await expect(page.getByTestId('plan-savings')).toHaveText('$0');
  await expect(page.locator('[data-testid^="leg-"]')).toHaveCount(1);
  await page.reload();
  await expect(page.getByTestId('list-search')).toBeVisible();
  await expect(page.getByTestId('lines').locator('li')).toHaveCount(11);
});

test('cerca: con permiso de ubicación muestra sedes reales de OSM y sus ofertas', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 4.6486, longitude: -74.0628 });
  await page.goto('cerca');
  await expect(page.getByTestId('consent')).toContainText('no se guarda');
  await page.getByTestId('locate').click();
  await expect(page.getByTestId('nearby-status')).toContainText('18 tiendas');
  await expect(page.getByTestId('map')).toBeVisible();
  await expect(page.locator('.pin.known')).toHaveCount(18);
  await expect(page.getByTestId('chains')).toContainText('Olímpica');
  await expect(page.getByTestId('places')).toContainText('Carulla');
  await page.getByRole('link', { name: /Ver \d+ precios de D1/ }).click();
  await expect(page).toHaveURL(/tiendas=d1/);
  await expect(page.getByTestId('results').locator('article').first()).toContainText('D1');
});

test('consentimiento: el banner no tapa la tarjeta de ubicación de "Cerca"', async ({ page }) => {
  await page.goto('cerca');
  await page.evaluate(() => localStorage.removeItem('napa:consent'));
  await page.reload();
  // La tarjeta de ubicación queda en el flujo de la página (no flotando sobre el banner).
  await expect(page.getByTestId('consent')).toHaveCSS('position', 'static');
  const banner = page.getByTestId('consent-banner');
  if (await banner.count()) {
    await expect(banner).toHaveCSS('position', 'fixed');
    await page.getByTestId('consent-reject').click();
    await expect(banner).toHaveCount(0);
  }
  await expect(page.getByTestId('locate')).toBeVisible();
  await page.getByTestId('locate').click({ trial: true });
});

test('fuentes: explica qué es real, qué es simulado y por qué', async ({ page }) => {
  await page.goto('');
  await go(page, 'Fuentes');
  await expect(page.getByTestId('mode-card')).toContainText('modo demo');
  await expect(page.getByTestId('sources-table').locator('tbody tr')).toHaveCount(11);
  await expect(page.getByTestId('source-jumbo')).toContainText('Real (backend)');
  await expect(page.getByTestId('source-exito')).toContainText('robots.txt');
  await expect(page.getByTestId('source-temu')).toContainText('Simulada');
  await expect(page.getByText('No hace scraping', { exact: true })).toBeVisible();
});

test('marca, tema y enlaces profundos', async ({ page }) => {
  await page.goto('producto/arroz-5kg');
  await expect(page.getByTestId('product-title')).toBeVisible();
  const brand = page.getByTestId('brand');
  await expect(brand).toHaveAttribute('href', 'https://jfredmc.github.io/portfolio/');
  await expect(brand).toHaveAttribute('target', '_blank');
  await expect(brand).toHaveAttribute('rel', /noopener/);
  const theme = await page.locator('html').getAttribute('data-theme');
  await page.getByTestId('theme-toggle').click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', theme ?? '');
  await page.reload();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', theme ?? '');
  await expect(page).toHaveTitle(/Ñapa/);
});

test('salidas a tiendas: pestaña nueva, rel sponsored y búsqueda en Éxito y Carulla', async ({
  page,
}) => {
  await page.goto('?q=arroz');
  const elsewhere = page.getByTestId('search-elsewhere');
  await expect(elsewhere.getByTestId('out-exito')).toHaveAttribute(
    'href',
    'https://www.exito.com/s?q=arroz',
  );
  await expect(elsewhere.getByTestId('out-carulla')).toHaveAttribute(
    'href',
    'https://www.carulla.com/s?q=arroz',
  );
  await page.getByTestId('results').getByTestId('compare').first().click();
  const main = page.getByTestId('out-main').locator('a');
  await expect(main).toHaveAttribute('target', '_blank');
  await expect(main).toHaveAttribute('rel', 'sponsored nofollow noopener');
  // En la demo los productos son ficticios: el botón abre la búsqueda de la tienda, no una ficha.
  await expect(main).toContainText('Buscar en');
  await expect(page.getByTestId('out-also').getByTestId('out-exito')).toHaveAttribute(
    'rel',
    'sponsored nofollow noopener',
  );
  // Sin IDs configurados, ningún enlace es de afiliado.
  await expect(page.locator('[data-affiliate="1"]')).toHaveCount(0);
});

test('páginas legales y aviso de afiliados', async ({ page }) => {
  await page.goto('');
  await expect(page.getByTestId('disclaimer')).toContainText('de afiliado');
  await page.getByTestId('legal-links').getByRole('link', { name: 'Privacidad' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('tratamiento de datos');
  await expect(page.getByTestId('legal-page')).toContainText('Ley 1581');
  await expect(page.getByTestId('legal-contact')).toBeVisible();
  await page.goto('afiliados');
  await expect(page.getByTestId('affiliate-disclosure')).toContainText('sin costo extra');
  await expect(page.getByTestId('affiliate-disclosure')).toContainText(
    'no cambian el orden, el puntaje ni los veredictos',
  );
  await page.goto('terminos');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Términos de uso');
  await page.goto('cookies');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Cookies');
  // Sin analítica ni anuncios configurados no hay banner ni scripts de terceros.
  await expect(page.getByTestId('consent-banner')).toHaveCount(0);
  await expect(
    page.locator('script[src*="googlesyndication"], script[src*="goatcounter"]'),
  ).toHaveCount(0);
});

test.describe('SEO: HTML prerenderizado', () => {
  // Lo que ven buscadores y vistas previas (WhatsApp, Telegram, X) sin ejecutar JavaScript.
  test.skip(({ isMobile }) => isMobile, 'una vez basta');

  const tag = (html: string, re: RegExp) => re.exec(html)?.[1] ?? null;
  const ld = (html: string) =>
    JSON.parse(tag(html, /<script id="napa-ld" type="application\/ld\+json">(.*?)<\/script>/s)!)[
      '@graph'
    ] as Record<string, unknown>[];

  test('inicio, categoría y producto con título, canónica, Open Graph y JSON-LD', async ({
    request,
  }) => {
    const home = await (await request.get('')).text();
    expect(tag(home, /<title>(.*?)<\/title>/)).toBe('Ñapa · Ofertas reales en Colombia');
    // La canónica es la URL pública del sitio (NAPA_SITE_URL), aunque se pruebe en localhost.
    const site = tag(home, /rel="canonical" href="([^"]+)"/)!;
    expect(site).toMatch(/^https:\/\/.+\/$/);
    const local = (url: string) => new URL(url).pathname.slice(new URL(site).pathname.length);
    expect(home).toContain('data-testid="snapshot-banner"');
    expect(ld(home).map((x) => x['@type'])).toEqual(['WebSite', 'ItemList']);

    const sitemap = await (await request.get('sitemap.xml')).text();
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
    expect(locs.length).toBeGreaterThan(50);
    const category = locs.find((l) => l.includes('/categoria/'))!;
    const product = locs.find((l) => l.includes('/producto/'))!;

    expect(category.startsWith(site)).toBe(true);
    const catRes = await request.get(local(category));
    expect(catRes.status()).toBe(200);
    const catHtml = await catRes.text();
    expect(tag(catHtml, /<title>(.*?)<\/title>/)).toMatch(/^Ofertas de .+ en Colombia hoy · Ñapa$/);
    expect(catHtml).toContain('data-testid="category-title"');

    const prodRes = await request.get(local(product));
    expect(prodRes.status()).toBe(200);
    const prodHtml = await prodRes.text();
    expect(tag(prodHtml, /name="robots" content="([^"]+)"/)).toContain('index');
    expect(tag(prodHtml, /property="og:type" content="([^"]+)"/)).toBe('product');
    const [p] = ld(prodHtml);
    expect(p!['@type']).toBe('Product');
    expect(JSON.stringify(p!['offers'])).toContain('"priceCurrency":"COP"');
  });

  test('robots.txt y 404 que abre la app (rutas solo de cliente)', async ({ request }) => {
    const robots = await (await request.get('robots.txt')).text();
    expect(robots).toMatch(/Sitemap: https?:\/\/.+\/sitemap\.xml/);
    const missing = await request.get('lista');
    expect(missing.status()).toBe(404);
    expect(await missing.text()).toContain('<app-root');
  });
});

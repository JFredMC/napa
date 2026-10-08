import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/** Sedes reales de OpenStreetMap alrededor de Chapinero (Bogotá) para no depender de Overpass. */
const OVERPASS = readFileSync(join(__dirname, 'fixtures', 'overpass-chapinero.json'), 'utf8');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e')) {
      localStorage.clear();
      sessionStorage.setItem('e2e', '1');
    }
  });
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

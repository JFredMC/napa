import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * Modo API con el servidor simulado por Playwright: respuestas reales del backend capturadas
 * (Jumbo y Olímpica en vivo, Éxito y Carulla bloqueadas) para no depender de Render ni de las tiendas.
 */
const SEARCH = readFileSync(join(__dirname, 'fixtures', 'api-search.json'), 'utf8');
const SOURCES = readFileSync(join(__dirname, 'fixtures', 'api-sources.json'), 'utf8');
const json = (route: Route, body: string) =>
  route.fulfill({
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body,
  });

async function mockApi(page: Page, health: (route: Route) => Promise<void>): Promise<void> {
  await page.route(/\/api\/health/, health);
  await page.route(/\/api\/search/, (route) => json(route, SEARCH));
  await page.route(/\/api\/sources/, (route) => json(route, SOURCES));
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e')) {
      localStorage.clear();
      sessionStorage.setItem('e2e', '1');
    }
  });
  await page.route(/overpass/, (route) => route.fulfill({ json: { elements: [] } }));
});

test('servidor despierto: modo API por defecto, precios reales marcadas en vivo', async ({
  page,
}) => {
  await mockApi(page, (route) => json(route, '{"status":"ok"}'));
  await page.goto('');
  await expect(page.getByTestId('api-banner')).toContainText('Modo API');
  await expect(page.getByTestId('demo-banner')).toHaveCount(0);
  await expect(page.getByTestId('mode-api')).toHaveClass(/on/);
  const live = page.getByTestId('tag-live');
  await expect(live.first()).toBeVisible();
  await expect(page.getByTestId('tag-sim')).toHaveCount(0);

  await page.goto('fuentes');
  await expect(page.getByTestId('mode-card')).toContainText('Modo API');
  await expect(page.getByTestId('source-jumbo')).toContainText('En vivo');
  await expect(page.getByTestId('source-olimpica')).toContainText('En vivo');
  await expect(page.getByTestId('source-exito')).toContainText('Bloqueada');
  await expect(page.getByTestId('access-exito')).toContainText('HTTP 429');
  await expect(page.getByTestId('source-temu')).toContainText('Simulada');
});

test('servidor dormido: avisa "despertando" con la demo y luego pasa a API', async ({ page }) => {
  let release!: () => void;
  const woke = new Promise<void>((r) => (release = r));
  await mockApi(page, async (route) => {
    await woke;
    await json(route, '{"status":"ok"}');
  });
  await page.goto('');
  const waking = page.getByTestId('waking-banner');
  await expect(waking).toContainText('Despertando el servidor');
  await expect(waking).toContainText('simulados');
  // Mientras despierta se ve la demo, marcada como simulada.
  await expect(page.getByTestId('top').getByTestId('tag-sim').first()).toBeVisible();
  release();
  await expect(page.getByTestId('api-banner')).toBeVisible({ timeout: 15_000 });
  await expect(waking).toHaveCount(0);
  await expect(page.getByTestId('tag-live').first()).toBeVisible();
});

test('servidor caído: se queda en demo, lo dice y ofrece reintentar', async ({ page }) => {
  await page.clock.install();
  await mockApi(page, (route) => route.abort('connectionrefused'));
  await page.goto('');
  await page.clock.fastForward(2_000);
  await expect(page.getByTestId('waking-banner')).toBeVisible();
  await page.clock.fastForward(80_000);
  await expect(page.getByTestId('demo-banner')).toContainText('simulados');
  await expect(page.getByTestId('server-down')).toContainText('no respondió');
  await expect(page.getByTestId('retry-api')).toBeVisible();
  await expect(page.getByTestId('tag-live')).toHaveCount(0);
});

test('el selector Demo/API recuerda la elección', async ({ page }) => {
  await mockApi(page, (route) => json(route, '{"status":"ok"}'));
  await page.goto('');
  await expect(page.getByTestId('api-banner')).toBeVisible();
  await page.getByTestId('mode-demo').click();
  await expect(page.getByTestId('demo-banner')).toBeVisible();
  await expect(page.getByTestId('server-down')).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('demo-banner')).toBeVisible();
  await page.getByTestId('mode-api').click();
  await expect(page.getByTestId('api-banner')).toBeVisible();
});

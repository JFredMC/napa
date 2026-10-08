import { expect, test } from '@playwright/test';

/**
 * Humo contra el servidor real en Render (sin simular nada). Solo corre con E2E_REAL_API=1,
 * desde el flujo "E2E en vivo", porque depende de Render y de las tiendas.
 */
test.skip(!process.env['E2E_REAL_API'], 'E2E_REAL_API no está activado');
test.setTimeout(150_000);

test('servidor real: despierta, trae precios en vivo de Jumbo y Olímpica', async ({ page }) => {
  await page.route(/overpass/, (route) => route.fulfill({ json: { elements: [] } }));
  await page.goto('?mode=api');
  // Plan gratuito: si estaba dormido, el aviso "Despertando…" puede durar hasta ~1 min.
  await expect(page.getByTestId('api-banner')).toBeVisible({ timeout: 100_000 });
  await page.getByTestId('search').fill('arroz');
  await page.getByTestId('search').press('Enter');
  await expect(page.getByTestId('tag-live').first()).toBeVisible({ timeout: 30_000 });
  await page.goto('fuentes?mode=api');
  await expect(page.getByTestId('api-banner')).toBeVisible({ timeout: 100_000 });
  await expect(page.getByTestId('source-jumbo')).toContainText('En vivo', { timeout: 20_000 });
  await expect(page.getByTestId('source-olimpica')).toContainText('En vivo');
  await expect(page.getByTestId('source-exito')).toContainText('Bloqueada');
});

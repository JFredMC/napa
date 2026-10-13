import { test as base, expect } from '@playwright/test';

/**
 * Las páginas públicas vienen prerenderizadas (SSG) con la foto de precios reales; la app del
 * navegador las reemplaza al arrancar. `goto` y `reload` esperan a esa app (html[data-app]) para
 * que las pruebas miren lo que ve la persona y no el HTML estático.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    const goto = page.goto.bind(page);
    const reload = page.reload.bind(page);
    // Con el reloj simulado (page.clock) la app no pinta hasta adelantar el tiempo: no se espera.
    let fakeClock = false;
    const install = page.clock.install.bind(page.clock);
    page.clock.install = async (options) => {
      fakeClock = true;
      await install(options);
    };
    const ready = async () => {
      if (!fakeClock) await page.waitForSelector('html[data-app="ready"]', { state: 'attached' });
    };
    page.goto = async (url, options) => {
      const res = await goto(url, options);
      await ready();
      return res;
    };
    page.reload = async (options) => {
      const res = await reload(options);
      await ready();
      return res;
    };
    await use(page);
  },
});

export { expect };
export type { Page, Route } from '@playwright/test';

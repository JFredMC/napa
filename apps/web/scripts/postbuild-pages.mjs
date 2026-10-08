// Archivos estáticos que GitHub Pages necesita junto al build.
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

export const out = new URL('../dist/web/browser/', import.meta.url).pathname;

/** Rutas públicas e indexables (las de datos personales del navegador quedan fuera). */
export const STATIC_ROUTES = ['', 'fuentes', 'privacidad', 'terminos', 'afiliados', 'cookies'];

export function postbuild(config, extraRoutes = []) {
  const site = new URL(config.siteUrl);
  const index = out + 'index.html';
  // URLs absolutas de Open Graph según el dominio configurado.
  const html = readFileSync(index, 'utf8').replaceAll(
    'https://jfredmc.github.io/napa/',
    config.siteUrl,
  );
  writeFileSync(index, html);
  if (!existsSync(out + '404.html')) copyFileSync(index, out + '404.html');
  writeFileSync(out + '.nojekyll', '');

  // Dominio propio: GitHub Pages lo lee del archivo CNAME.
  if (!site.hostname.endsWith('github.io')) writeFileSync(out + 'CNAME', site.hostname + '\n');

  // ads.txt solo sirve en la raíz de un dominio propio; en github.io se genera igual por si acaso.
  if (config.adsense) {
    const pub = config.adsense.client.replace(/^ca-/, '');
    writeFileSync(out + 'ads.txt', `google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`);
  }

  const routes = [...STATIC_ROUTES, ...extraRoutes];
  const today = new Date().toISOString().slice(0, 10);
  const urls = routes
    .map(
      (r) =>
        `  <url><loc>${new URL(r, config.siteUrl).href}</loc><lastmod>${today}</lastmod></url>`,
    )
    .join('\n');
  writeFileSync(
    out + 'sitemap.xml',
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
  );
  // En github.io este robots.txt queda en /napa/ y no aplica (manda el de jfredmc.github.io);
  // con dominio propio queda en la raíz.
  writeFileSync(
    out + 'robots.txt',
    `User-agent: *\nAllow: /\nDisallow: ${site.pathname}lista\nDisallow: ${site.pathname}guardados\n\nSitemap: ${new URL('sitemap.xml', config.siteUrl).href}\n`,
  );
  console.log(
    `[postbuild] sitemap con ${routes.length} rutas${config.adsense ? ', ads.txt' : ''}${site.hostname.endsWith('github.io') ? '' : ', CNAME ' + site.hostname}`,
  );
}

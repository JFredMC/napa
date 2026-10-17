// Archivos estáticos que GitHub Pages necesita junto al build.
import {
  copyFileSync,
  existsSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, relative } from 'node:path';

export const out = new URL('../dist/web/browser/', import.meta.url).pathname;

/** Rutas públicas e indexables (las de datos personales del navegador quedan fuera). */
export const STATIC_ROUTES = ['', 'fuentes', 'privacidad', 'terminos', 'afiliados', 'cookies'];

/** Todos los .html del build (recursivo). */
function htmlFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return htmlFiles(path);
    return name.endsWith('.html') ? [path] : [];
  });
}

/**
 * Angular escribe cada ruta prerenderizada como `ruta/index.html`; GitHub Pages respondería
 * `/ruta` con una redirección a `/ruta/`. Como `ruta.html` se sirve directo en `/ruta`, se mueven
 * (URLs limpias, iguales a las del router y a las canónicas).
 */
export function flattenRoutes(dir = out) {
  let moved = 0;
  for (const file of htmlFiles(dir)) {
    const rel = relative(dir, file);
    if (!rel.endsWith('/index.html')) continue;
    const folder = file.slice(0, -'/index.html'.length);
    renameSync(file, folder + '.html');
    if (!readdirSync(folder).length) rmdirSync(folder);
    moved++;
  }
  return moved;
}

/**
 * XML del sitemap. Cada ruta puede ser texto o `{ path, lastmod }`; el `lastmod` solo se
 * emite si trae una fecha real (AAAA-MM-DD) de los datos. Antes se ponía la fecha del
 * build a las 851 URLs y Google terminaba ignorándola por inverosímil.
 */
export function sitemapXml(siteUrl, routes) {
  const urls = routes
    .map((r) => {
      const path = typeof r === 'string' ? r : r.path;
      const lastmod = typeof r === 'string' ? '' : (r.lastmod ?? '');
      const date = /^\d{4}-\d{2}-\d{2}$/.test(lastmod) ? lastmod : '';
      return `  <url><loc>${new URL(path, siteUrl).href}</loc>${date ? `<lastmod>${date}</lastmod>` : ''}</url>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function postbuild(config, extraRoutes = []) {
  const site = new URL(config.siteUrl);
  // URLs absolutas de Open Graph según el dominio configurado (las páginas prerenderizadas ya
  // salen con el dominio de site-config.json; esto cubre el index.html base).
  for (const file of htmlFiles(out)) {
    const html = readFileSync(file, 'utf8');
    const fixed = html.replaceAll('https://napaofertas.com/', config.siteUrl);
    if (fixed !== html) writeFileSync(file, fixed);
  }
  // Google Search Console (método meta o archivo HTML).
  const gv = config.googleVerification ?? {};
  if (gv.meta) {
    const tag = `<meta name="google-site-verification" content="${gv.meta}">`;
    for (const file of htmlFiles(out)) {
      const html = readFileSync(file, 'utf8');
      if (!html.includes('google-site-verification'))
        writeFileSync(file, html.replace('</head>', `${tag}</head>`));
    }
  }
  if (gv.file) writeFileSync(out + gv.file, `google-site-verification: ${gv.file}\n`);
  const moved = flattenRoutes();
  // Rutas solo de cliente (lista, guardados, cerca, productos nuevos): GitHub Pages sirve
  // 404.html, que es la app sin prerenderizar y el router resuelve la ruta.
  const shell = existsSync(out + 'index.csr.html') ? out + 'index.csr.html' : out + 'index.html';
  copyFileSync(shell, out + '404.html');
  writeFileSync(out + '.nojekyll', '');

  // Dominio propio: GitHub Pages lo lee del archivo CNAME.
  if (!site.hostname.endsWith('github.io')) writeFileSync(out + 'CNAME', site.hostname + '\n');

  // ads.txt solo sirve en la raíz de un dominio propio; en github.io se genera igual por si acaso.
  if (config.adsense) {
    const pub = config.adsense.client.replace(/^ca-/, '');
    writeFileSync(out + 'ads.txt', `google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`);
  }

  const routes = [...STATIC_ROUTES, ...extraRoutes];
  writeFileSync(out + 'sitemap.xml', sitemapXml(config.siteUrl, routes));
  // En github.io este robots.txt queda en /napa/ y no aplica (manda el de jfredmc.github.io);
  // con dominio propio queda en la raíz.
  writeFileSync(
    out + 'robots.txt',
    `User-agent: *\nAllow: /\nDisallow: ${site.pathname}lista\nDisallow: ${site.pathname}guardados\n\nSitemap: ${new URL('sitemap.xml', config.siteUrl).href}\n`,
  );
  console.log(
    `[postbuild] ${moved} páginas prerenderizadas, sitemap con ${routes.length} rutas${config.adsense ? ', ads.txt' : ''}${site.hostname.endsWith('github.io') ? '' : ', CNAME ' + site.hostname}`,
  );
}

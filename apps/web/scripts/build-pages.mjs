// Build para GitHub Pages (o un dominio propio):
// 1. genera src/site-config.json desde variables NAPA_* (ver scripts/site-config.mjs);
// 2. compila con el base href que corresponde a NAPA_SITE_URL (/napa/ en github.io, / con dominio);
//    y prerenderiza (SSG) inicio, categorías, fuentes, legales y productos de src/snapshot.json;
// 3. agrega 404.html, .nojekyll, CNAME (dominio propio), ads.txt (AdSense), robots.txt y sitemap.xml.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { buildSiteConfig } from './site-config.mjs';
import { postbuild } from './postbuild-pages.mjs';

const config = buildSiteConfig();
writeFileSync(
  new URL('../src/site-config.json', import.meta.url),
  JSON.stringify(config, null, 2) + '\n',
);
const base = new URL(config.siteUrl).pathname;
console.log(`[build-pages] ${config.siteUrl} (base href ${base})`);

const ng = spawnSync('ng', ['build', '--base-href', base], { stdio: 'inherit', shell: true });
if (ng.status !== 0) process.exit(ng.status ?? 1);
// Sitemap: categorías con precios reales y una página por producto de la foto (src/snapshot.json).
const snapshot = JSON.parse(readFileSync(new URL('../src/snapshot.json', import.meta.url), 'utf8'));
// lastmod real por ruta: la última vez que Ñapa observó un precio de ese producto/categoría
// en la foto (observedAt de las ofertas), no la fecha en que corrió el build.
const lastObserved = (offers) => {
  const times = offers.map((o) => Date.parse(o.observedAt)).filter(Number.isFinite);
  return times.length ? new Date(Math.max(...times)).toISOString().slice(0, 10) : undefined;
};
const byCategory = new Map();
const byProduct = new Map();
for (const o of snapshot.offers) {
  byCategory.set(o.category, [...(byCategory.get(o.category) ?? []), o]);
  byProduct.set(o.productKey, [...(byProduct.get(o.productKey) ?? []), o]);
}
const categories = [...byCategory].map(([cat, offers]) => ({
  path: `categoria/${cat}`,
  lastmod: lastObserved(offers),
}));
const products = [...byProduct].map(([key, offers]) => ({
  path: `producto/${encodeURIComponent(key)}`,
  lastmod: lastObserved(offers),
}));
const staples = JSON.parse(readFileSync(new URL('../src/staples.json', import.meta.url), 'utf8'));
const prices = staples.map((s) => `precio/${s.slug}`);
postbuild(config, [...categories, ...prices, ...products]);

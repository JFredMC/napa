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
const categories = [...new Set(snapshot.offers.map((o) => `categoria/${o.category}`))];
const products = [
  ...new Set(snapshot.offers.map((o) => `producto/${encodeURIComponent(o.productKey)}`)),
];
const staples = JSON.parse(readFileSync(new URL('../src/staples.json', import.meta.url), 'utf8'));
const prices = staples.map((s) => `precio/${s.slug}`);
postbuild(config, [...categories, ...prices, ...products]);

// Build para GitHub Pages (o un dominio propio):
// 1. genera src/site-config.json desde variables NAPA_* (ver scripts/site-config.mjs);
// 2. compila con el base href que corresponde a NAPA_SITE_URL (/napa/ en github.io, / con dominio);
// 3. agrega 404.html, .nojekyll, CNAME (dominio propio), ads.txt (AdSense), robots.txt y sitemap.xml.
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
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
postbuild(config);

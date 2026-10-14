// Foto de precios reales para prerenderizar (SEO) y para mostrar mientras el servidor despierta.
// Pide al backend de Ñapa (que respeta robots.txt, caché y ritmo de cada tienda) unas búsquedas
// básicas y guarda solo las ofertas en vivo en src/snapshot.json. Si algo falla, deja el archivo
// anterior: el build nunca depende de que Render esté despierto.
import { readFileSync, writeFileSync } from 'node:fs';

const api = (process.env.NAPA_API_URL || 'https://napa-api.onrender.com').replace(/\/$/, '');
const TERMS = [
  'arroz',
  'aceite',
  'leche',
  'cafe',
  'huevos',
  'atun',
  'azucar',
  'pasta',
  'detergente',
  'shampoo',
  'panales',
  'chocolate',
];
// Básicos con página /precio/<slug> (src/staples.json): también se consultan.
const STAPLES = JSON.parse(readFileSync(new URL('../src/staples.json', import.meta.url), 'utf8'));
for (const s of STAPLES) if (!TERMS.includes(s.q)) TERMS.push(s.q);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function wake() {
  const end = Date.now() + 120_000;
  while (Date.now() < end) {
    try {
      const res = await fetch(`${api}/api/health`, { signal: AbortSignal.timeout(60_000) });
      if (res.ok) return true;
    } catch {
      /* despertando */
    }
    await sleep(5000);
  }
  return false;
}

async function main() {
  if (!(await wake())) throw new Error(`${api} no respondió`);
  const offers = new Map();
  for (const q of TERMS) {
    const res = await fetch(
      `${api}/api/search?q=${encodeURIComponent(q)}&stores=jumbo,olimpica&limit=24`,
      {
        signal: AbortSignal.timeout(60_000),
      },
    );
    if (!res.ok) throw new Error(`${q}: HTTP ${res.status}`);
    const data = await res.json();
    for (const o of data.offers) {
      if (o.source !== 'live') continue;
      offers.set(o.id, { ...o, history: (o.history ?? []).slice(-30) });
    }
    await sleep(500);
  }
  if (offers.size < 20) throw new Error(`muy pocas ofertas en vivo (${offers.size})`);
  const snapshot = {
    fetchedAt: new Date().toISOString(),
    terms: TERMS,
    offers: [...offers.values()],
  };
  writeFileSync(new URL('../src/snapshot.json', import.meta.url), JSON.stringify(snapshot) + '\n');
  console.log(`[snapshot] ${snapshot.offers.length} ofertas en vivo de ${api}`);
}

main().catch((e) => {
  console.warn(`[snapshot] se conserva la foto anterior: ${e.message}`);
});

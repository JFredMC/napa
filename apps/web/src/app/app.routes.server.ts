import { RenderMode, type ServerRoute } from '@angular/ssr';
import { CATEGORY_IDS } from '@napa/connectors';
import { loadSnapshot } from './core/snapshot';

/**
 * Qué se prerenderiza al compilar (sitio estático en GitHub Pages):
 * inicio, categorías, fuentes, páginas legales y una página por producto de la foto de precios
 * reales (src/snapshot.json). Lista, guardados y cerca dependen del navegador: solo cliente.
 */
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  {
    path: 'categoria/:cat',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: async () => CATEGORY_IDS.map((cat) => ({ cat })),
  },
  {
    path: 'producto/:key',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: async () => {
      const snap = await loadSnapshot();
      return [...new Set(snap.offers.map((o) => o.productKey))].map((key) => ({ key }));
    },
  },
  { path: 'fuentes', renderMode: RenderMode.Prerender },
  { path: 'privacidad', renderMode: RenderMode.Prerender },
  { path: 'terminos', renderMode: RenderMode.Prerender },
  { path: 'afiliados', renderMode: RenderMode.Prerender },
  { path: 'cookies', renderMode: RenderMode.Prerender },
  { path: '**', renderMode: RenderMode.Client },
];

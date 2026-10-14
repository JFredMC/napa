import type { Routes } from '@angular/router';

/** Títulos y metadatos los pone cada página con Seo (también al prerenderizar). */
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/deals/deals-page').then((m) => m.DealsPage),
  },
  {
    path: 'categoria/:cat',
    loadComponent: () => import('./features/deals/deals-page').then((m) => m.DealsPage),
  },
  {
    path: 'producto/:key',
    loadComponent: () => import('./features/product/product-page').then((m) => m.ProductPage),
  },
  {
    path: 'precio/:slug',
    loadComponent: () => import('./features/price/price-page').then((m) => m.PricePage),
  },
  {
    path: 'lista',
    loadComponent: () => import('./features/list/list-page').then((m) => m.ListPage),
  },
  {
    path: 'guardados',
    loadComponent: () => import('./features/saved/saved-page').then((m) => m.SavedPage),
  },
  {
    path: 'cerca',
    loadComponent: () => import('./features/nearby/nearby-page').then((m) => m.NearbyPage),
  },
  {
    path: 'fuentes',
    loadComponent: () => import('./features/sources/sources-page').then((m) => m.SourcesPage),
  },
  {
    path: 'privacidad',
    data: { doc: 'privacidad' },
    loadComponent: () => import('./features/legal/legal-page').then((m) => m.LegalPage),
  },
  {
    path: 'terminos',
    data: { doc: 'terminos' },
    loadComponent: () => import('./features/legal/legal-page').then((m) => m.LegalPage),
  },
  {
    path: 'afiliados',
    data: { doc: 'afiliados' },
    loadComponent: () => import('./features/legal/legal-page').then((m) => m.LegalPage),
  },
  {
    path: 'cookies',
    data: { doc: 'cookies' },
    loadComponent: () => import('./features/legal/legal-page').then((m) => m.LegalPage),
  },
  { path: '**', redirectTo: '' },
];

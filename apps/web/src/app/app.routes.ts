import type { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Ñapa · Ofertas reales en Colombia',
    loadComponent: () => import('./features/deals/deals-page').then((m) => m.DealsPage),
  },
  {
    path: 'producto/:key',
    title: 'Comparar precios · Ñapa',
    loadComponent: () => import('./features/product/product-page').then((m) => m.ProductPage),
  },
  {
    path: 'lista',
    title: 'Lista de compras · Ñapa',
    loadComponent: () => import('./features/list/list-page').then((m) => m.ListPage),
  },
  {
    path: 'guardados',
    title: 'Favoritos y alertas · Ñapa',
    loadComponent: () => import('./features/saved/saved-page').then((m) => m.SavedPage),
  },
  {
    path: 'cerca',
    title: 'Tiendas cerca · Ñapa',
    loadComponent: () => import('./features/nearby/nearby-page').then((m) => m.NearbyPage),
  },
  {
    path: 'fuentes',
    title: 'Fuentes · Ñapa',
    loadComponent: () => import('./features/sources/sources-page').then((m) => m.SourcesPage),
  },
  {
    path: 'privacidad',
    title: 'Política de privacidad · Ñapa',
    data: { doc: 'privacidad' },
    loadComponent: () => import('./features/legal/legal-page').then((m) => m.LegalPage),
  },
  {
    path: 'terminos',
    title: 'Términos de uso · Ñapa',
    data: { doc: 'terminos' },
    loadComponent: () => import('./features/legal/legal-page').then((m) => m.LegalPage),
  },
  {
    path: 'afiliados',
    title: 'Afiliados y publicidad · Ñapa',
    data: { doc: 'afiliados' },
    loadComponent: () => import('./features/legal/legal-page').then((m) => m.LegalPage),
  },
  {
    path: 'cookies',
    title: 'Cookies · Ñapa',
    data: { doc: 'cookies' },
    loadComponent: () => import('./features/legal/legal-page').then((m) => m.LegalPage),
  },
  { path: '**', redirectTo: '' },
];

/**
 * Tipos del dominio. El motor no hace IO: recibe ofertas normalizadas (vengan de una API real o
 * de un adaptador simulado) y devuelve análisis, puntajes, rankings y planes de compra.
 */

/** De dónde sale un precio. `simulated` nunca debe mostrarse como precio real vigente. */
export type Source = 'live' | 'simulated';

export type CategoryId =
  | 'despensa'
  | 'lacteos'
  | 'bebidas'
  | 'aseo-hogar'
  | 'cuidado-personal'
  | 'bebe'
  | 'mascotas'
  | 'tecnologia'
  | 'electrohogar'
  | 'hogar'
  | 'moda'
  | 'belleza';

/** Unidad base para precio por unidad: gramos, mililitros o unidades. */
export type BaseUnit = 'g' | 'ml' | 'u';

/** Contenido total del empaque en unidad base (6 × 330 ml = 1980 ml). */
export interface Size {
  amount: number;
  unit: BaseUnit;
}

export interface Shipping {
  /** Costo del envío en COP (0 = gratis). */
  cost: number;
  /** Envío gratis desde este subtotal en COP. */
  freeFrom?: number;
  minDays: number;
  maxDays: number;
  /** Permite recoger en tienda. */
  pickup?: boolean;
}

export interface StoreInfo {
  id: string;
  name: string;
  /** Calificación de 0 a 5. */
  rating: number;
  ratingCount: number;
  shipping: Shipping;
}

export interface PricePoint {
  /** Día en formato YYYY-MM-DD. */
  date: string;
  price: number;
  listPrice?: number;
}

export interface Offer {
  id: string;
  /** Agrupa el mismo producto en distintas tiendas. */
  productKey: string;
  storeId: string;
  title: string;
  brand: string;
  category: CategoryId;
  /** Precio actual en COP. */
  price: number;
  /** Precio "antes" o de lista que muestra la tienda (≥ price). */
  listPrice: number;
  size?: Size;
  url?: string;
  image?: string;
  source: Source;
  /** Momento en que se leyó (o se generó) el precio, ISO 8601. */
  observedAt: string;
  /** Historial diario, del más antiguo al más reciente; el último punto es el precio actual. */
  history?: PricePoint[];
  seller?: string;
  stock?: number;
}

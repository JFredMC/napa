import type { CategoryId, StoreInfo } from '@napa/deals-engine';
import type { BrandRule } from '@napa/deals-engine';

export type StoreKind =
  'supermercado' | 'descuento' | 'marketplace' | 'tecnologia' | 'departamentos' | 'moda';

/**
 * Qué fuente usa cada tienda:
 * - `vtex`: catálogo público de VTEX, solo si su robots.txt lo permite.
 * - `mercadolibre-api`: API oficial, requiere token OAuth.
 * - `none`: sin API pública; siempre simulada (no se hace scraping).
 */
export type LiveSource = 'vtex' | 'mercadolibre-api' | 'none';

export interface StoreMeta extends StoreInfo {
  kind: StoreKind;
  /** Color de marca para el distintivo en la interfaz. */
  color: string;
  website: string;
  liveSource: LiveSource;
  /** Origen del catálogo VTEX, si aplica. */
  vtexOrigin?: string;
  /**
   * Prefijos que Ñapa trata como prohibidos aunque el robots.txt, por cómo está escrito, no
   * los aplique al grupo `*` (la intención de la tienda es clara y se respeta).
   */
  respectDisallow?: readonly string[];
  /**
   * Página pública que su robots.txt sí permite (el sitemap que el propio robots.txt anuncia).
   * El backend la pide de vez en cuando (máx. cada 12 h, a pedido) solo para comprobar si la
   * tienda acepta a un robot que se identifica. No se descarga ni se recorre nada más.
   */
  accessProbeUrl?: string;
  /** Por qué la fuente es real, está bloqueada o es simulada. */
  sourceNote: string;
  /** Nombres en OpenStreetMap para reconocer sedes cercanas. Vacío = solo en línea. */
  osm: readonly string[];
  categories: readonly CategoryId[];
}

const GROCERY: CategoryId[] = [
  'despensa',
  'lacteos',
  'bebidas',
  'aseo-hogar',
  'cuidado-personal',
  'bebe',
  'mascotas',
];

/**
 * Las tiendas son reales; en la demo, sus precios, calificaciones y condiciones de envío son
 * ilustrativos y así se marcan en la interfaz.
 */
export const STORES: Record<string, StoreMeta> = {
  mercadolibre: {
    id: 'mercadolibre',
    name: 'Mercado Libre',
    kind: 'marketplace',
    color: '#ffe600',
    website: 'https://www.mercadolibre.com.co',
    rating: 4.6,
    ratingCount: 182_000,
    shipping: { cost: 9900, freeFrom: 60000, minDays: 1, maxDays: 3 },
    liveSource: 'mercadolibre-api',
    sourceNote:
      'API oficial de Mercado Libre. La búsqueda exige un token OAuth de una aplicación registrada; sin token responde 403, así que sin credenciales queda simulada.',
    osm: [],
    categories: [
      'despensa',
      'aseo-hogar',
      'cuidado-personal',
      'bebe',
      'mascotas',
      'tecnologia',
      'electrohogar',
      'hogar',
      'moda',
      'belleza',
    ],
  },
  exito: {
    id: 'exito',
    name: 'Éxito',
    kind: 'supermercado',
    color: '#ffd200',
    website: 'https://www.exito.com',
    rating: 4.3,
    ratingCount: 96_000,
    shipping: { cost: 7900, freeFrom: 150000, minDays: 0, maxDays: 1, pickup: true },
    liveSource: 'vtex',
    vtexOrigin: 'https://www.exito.com',
    respectDisallow: ['/api/'],
    sourceNote:
      'Su robots.txt prohíbe /api/ (el catálogo VTEX) y las búsquedas (/s?). Lo único permitido serían las fichas de producto y el sitemap que anuncia, pero su protección anti-bots responde HTTP 429 «rate-limit-reason: bot» a un robot que se identifica, y sus términos limitan el sitio al uso personal. Saltarse eso exigiría disfrazar el robot, así que queda simulada hasta tener permiso o un convenio con Grupo Éxito.',
    accessProbeUrl: 'https://www.exito.com/sitemap/sitemap.xml',
    osm: ['Éxito', 'Exito', 'Éxito Express', 'Almacenes Éxito'],
    categories: [...GROCERY, 'tecnologia', 'electrohogar', 'hogar', 'moda'],
  },
  carulla: {
    id: 'carulla',
    name: 'Carulla',
    kind: 'supermercado',
    color: '#00843d',
    website: 'https://www.carulla.com',
    rating: 4.5,
    ratingCount: 41_000,
    shipping: { cost: 8900, freeFrom: 180000, minDays: 0, maxDays: 1, pickup: true },
    liveSource: 'vtex',
    vtexOrigin: 'https://www.carulla.com',
    respectDisallow: ['/api/'],
    sourceNote:
      'Mismo grupo y plataforma que Éxito: robots.txt prohíbe /api/ y las búsquedas, así que la única vía permitida sería descargar su sitemap completo y leer ficha por ficha, un rastreo masivo que Ñapa no hace. Su anti-bots además responde 429 «bot» de forma intermitente (desde el servidor en Render su sitemap sí respondió el 8 oct. 2026). Queda simulada hasta tener permiso o un convenio con Grupo Éxito.',
    accessProbeUrl: 'https://www.carulla.com/sitemap/sitemap.xml',
    osm: ['Carulla', 'Carulla Fresh Market', 'Carulla Express'],
    categories: [...GROCERY, 'hogar'],
  },
  jumbo: {
    id: 'jumbo',
    name: 'Jumbo',
    kind: 'supermercado',
    color: '#00a650',
    website: 'https://www.jumbocolombia.com',
    rating: 4.2,
    ratingCount: 38_000,
    shipping: { cost: 8900, freeFrom: 150000, minDays: 1, maxDays: 2, pickup: true },
    liveSource: 'vtex',
    vtexOrigin: 'https://www.jumbocolombia.com',
    sourceNote:
      'Catálogo público de VTEX (/api/catalog_system/pub). Su robots.txt no lo prohíbe: el backend lo consulta con caché, límite de ritmo y un User-Agent que se identifica.',
    osm: ['Jumbo', 'Hipermercado Jumbo'],
    categories: [...GROCERY, 'tecnologia', 'electrohogar', 'hogar'],
  },
  olimpica: {
    id: 'olimpica',
    name: 'Olímpica',
    kind: 'supermercado',
    color: '#e30613',
    website: 'https://www.olimpica.com',
    rating: 4.1,
    ratingCount: 33_000,
    shipping: { cost: 6900, freeFrom: 120000, minDays: 1, maxDays: 2, pickup: true },
    liveSource: 'vtex',
    vtexOrigin: 'https://www.olimpica.com',
    sourceNote:
      'Catálogo público de VTEX. Su robots.txt bloquea /busca y cualquier URL con "&" o "%", así que el backend consulta la API de catálogo con una sola palabra (?ft=arroz), sin tildes ni paginación, y filtra el resto de la búsqueda en el backend, con caché y límite de ritmo.',
    osm: ['Olímpica', 'Olimpica', 'SAO', 'Superalmacenes Olímpica', 'Supertiendas Olímpica'],
    categories: [...GROCERY, 'tecnologia', 'electrohogar', 'hogar'],
  },
  d1: {
    id: 'd1',
    name: 'D1',
    kind: 'descuento',
    color: '#e2001a',
    website: 'https://www.tiendasd1.com',
    rating: 4.4,
    ratingCount: 52_000,
    shipping: { cost: 5900, freeFrom: 90000, minDays: 0, maxDays: 1, pickup: true },
    liveSource: 'none',
    sourceNote:
      'No ofrece una API pública de catálogo. Ñapa no hace scraping: sus precios son simulados.',
    osm: ['D1', 'Tiendas D1', 'Tienda D1'],
    categories: GROCERY,
  },
  ara: {
    id: 'ara',
    name: 'Ara',
    kind: 'descuento',
    color: '#f39200',
    website: 'https://aratiendas.com',
    rating: 4.3,
    ratingCount: 27_000,
    shipping: { cost: 4900, freeFrom: 80000, minDays: 0, maxDays: 1, pickup: true },
    liveSource: 'none',
    sourceNote: 'Sin API pública de catálogo. Sus precios son simulados.',
    osm: ['Ara', 'Tiendas Ara', 'Tienda Ara'],
    categories: GROCERY,
  },
  alkosto: {
    id: 'alkosto',
    name: 'Alkosto',
    kind: 'tecnologia',
    color: '#004797',
    website: 'https://www.alkosto.com',
    rating: 4.4,
    ratingCount: 61_000,
    shipping: { cost: 12900, freeFrom: 99000, minDays: 2, maxDays: 5, pickup: true },
    liveSource: 'none',
    sourceNote: 'Sin API pública de catálogo para terceros. Sus precios son simulados.',
    osm: ['Alkosto'],
    categories: ['despensa', 'aseo-hogar', 'mascotas', 'tecnologia', 'electrohogar', 'hogar'],
  },
  falabella: {
    id: 'falabella',
    name: 'Falabella',
    kind: 'departamentos',
    color: '#aad500',
    website: 'https://www.falabella.com.co',
    rating: 4.0,
    ratingCount: 47_000,
    shipping: { cost: 9900, freeFrom: 99900, minDays: 2, maxDays: 5 },
    liveSource: 'none',
    sourceNote:
      'Su API es solo para vendedores (Seller Center), no para consultar el catálogo. Precios simulados.',
    osm: ['Falabella'],
    categories: ['tecnologia', 'electrohogar', 'hogar', 'moda', 'belleza'],
  },
  shein: {
    id: 'shein',
    name: 'Shein',
    kind: 'moda',
    color: '#111111',
    website: 'https://www.shein.com.co',
    rating: 3.9,
    ratingCount: 120_000,
    shipping: { cost: 11900, freeFrom: 149000, minDays: 6, maxDays: 12 },
    liveSource: 'none',
    sourceNote:
      'Sin API pública y sus términos prohíben la extracción automatizada. Precios simulados.',
    osm: [],
    categories: ['moda', 'belleza', 'hogar'],
  },
  temu: {
    id: 'temu',
    name: 'Temu',
    kind: 'marketplace',
    color: '#fb7701',
    website: 'https://www.temu.com',
    rating: 3.8,
    ratingCount: 95_000,
    shipping: { cost: 0, minDays: 7, maxDays: 15 },
    liveSource: 'none',
    sourceNote:
      'Sin API pública y sus términos prohíben la extracción automatizada. Precios simulados.',
    osm: [],
    categories: ['tecnologia', 'hogar', 'moda', 'belleza'],
  },
};

export const STORE_IDS = Object.keys(STORES);

/** Reglas para reconocer sedes en OpenStreetMap (más específicas primero). */
export const BRAND_RULES: BrandRule[] = Object.values(STORES)
  .filter((s) => s.osm.length)
  .map((s) => ({ storeId: s.id, patterns: s.osm }));

export const CATEGORY_LABEL: Record<CategoryId, string> = {
  despensa: 'Despensa',
  lacteos: 'Lácteos y huevos',
  bebidas: 'Bebidas',
  'aseo-hogar': 'Aseo del hogar',
  'cuidado-personal': 'Cuidado personal',
  bebe: 'Bebé',
  mascotas: 'Mascotas',
  tecnologia: 'Tecnología',
  electrohogar: 'Electrohogar',
  hogar: 'Hogar',
  moda: 'Moda',
  belleza: 'Belleza',
};

export const CATEGORY_IDS = Object.keys(CATEGORY_LABEL) as CategoryId[];

import { norm } from './text';

export interface LatLng {
  lat: number;
  lng: number;
}

/** Distancia en km entre dos puntos (fórmula del haversine). */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface BrandRule {
  storeId: string;
  /** Nombres o marcas en OpenStreetMap (`brand`, `name`, `operator`). */
  patterns: readonly string[];
}

/** Reconoce la cadena de un punto de OpenStreetMap por sus etiquetas. */
export function matchBrand(
  tags: Readonly<Record<string, string | undefined>>,
  rules: readonly BrandRule[],
): string | null {
  const hay = [tags['brand'], tags['name'], tags['operator'], tags['brand:es']]
    .filter((v): v is string => !!v)
    .map((v) => ` ${norm(v)} `);
  if (!hay.length) return null;
  for (const rule of rules) {
    for (const p of rule.patterns) {
      const needle = ` ${norm(p)} `;
      if (hay.some((h) => h.includes(needle))) return rule.storeId;
    }
  }
  return null;
}

/** Consulta Overpass QL: supermercados y tiendas de barrio alrededor de un punto. */
export function overpassQuery(center: LatLng, radiusM: number): string {
  const r = Math.round(Math.min(Math.max(radiusM, 200), 5000));
  const around = `around:${r},${center.lat.toFixed(5)},${center.lng.toFixed(5)}`;
  return `[out:json][timeout:20];(nwr["shop"~"^(supermarket|convenience|department_store|wholesale)$"](${around}););out center tags 200;`;
}

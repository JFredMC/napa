import type { Offer } from '@napa/deals-engine';
import raw from '../../staples.json';

/** Productos básicos con página /precio/<slug> (SEO). La lista la comparte scripts/snapshot.mjs. */
export interface Staple {
  slug: string;
  /** Nombre para mostrar ("azúcar"). */
  name: string;
  /** Búsqueda en el backend; todas sus palabras deben estar en el título. */
  q: string;
}
export const STAPLES = raw as Staple[];
export const stapleBySlug = (slug: string | null) => STAPLES.find((s) => s.slug === slug) ?? null;

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
const NOT_GROCERY =
  /\b(extractor|organizador|camion|juguete|cuna|olla|hervidor|cafetera|sofa|termo|vaso|toalla|cobija|silla|lampara|sarten|licuadora|dispensador|portarrollo|molde|recipiente|set|kit|whiskas|kelcat|gato|gatos|perro|perros|mascota|mascotas|alfombra)\b/;

/** El producto ES el básico: el título empieza por él ("Arroz Roa…", no "Atún en aceite"). */
export function isStaple(title: string, staple: Staple): boolean {
  const t = norm(title);
  if (NOT_GROCERY.test(t)) return false;
  const words = t.split(/[^a-z0-9]+/).filter(Boolean);
  const kws = norm(staple.q).split(/\s+/);
  const first = kws[0]!;
  const singular = first.replace(/(es|s)$/, '');
  const hit = (w: string) =>
    w === first || w === singular || w === `${singular}s` || w === `${singular}es`;
  return (
    !!words[0] &&
    hit(words[0]) &&
    kws.slice(1).every((k) => words.some((w) => w.startsWith(k.slice(0, 5))))
  );
}

/** Precio por kilo/litro imposible (producto al peso mal cargado). */
export function absurdUnit(o: Offer): boolean {
  const s = o.size;
  if (!s || !s.amount || s.unit === 'u') return false;
  return (o.price / s.amount) * 1000 > 150_000;
}

export function stapleOffers(offers: Offer[], staple: Staple): Offer[] {
  return offers
    .filter((o) => o.source === 'live' && isStaple(o.title, staple) && !absurdUnit(o))
    .sort((a, b) => a.price - b.price);
}

import type { BaseUnit, Size } from './types';
import { norm } from './text';

/** "1.000" → 1000, "2,5" → 2.5, "1.5" → 1.5 (formato colombiano y anglosajón). */
export function parseAmount(raw: string): number {
  const s = raw.trim();
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ''));
  return Number(s.replace(',', '.'));
}

const MASS: Record<string, number> = {
  kg: 1000,
  kilo: 1000,
  kilos: 1000,
  g: 1,
  gr: 1,
  grs: 1,
  gramos: 1,
  lb: 500,
  libra: 500,
  libras: 500,
};
const VOLUME: Record<string, number> = {
  l: 1000,
  lt: 1000,
  lts: 1000,
  litro: 1000,
  litros: 1000,
  ml: 1,
  cc: 1,
};
const COUNT =
  '(?:und|unds|unidades|unidad|uds|u|rollos|panales|bolsas|sobres|capsulas|tabletas|piezas)';
const UNIT = '(kg|kilos?|gr|grs|gramos|g|lb|libras?|lts|lt|litros?|l|ml|cc)';
const NUM = '(\\d+(?:[.,]\\d+)*)';

function toBase(amount: number, unit: string): Size | null {
  if (!(amount > 0)) return null;
  const mass = MASS[unit];
  if (mass) return { amount: amount * mass, unit: 'g' };
  const volume = VOLUME[unit];
  if (volume) return { amount: amount * volume, unit: 'ml' };
  return null;
}

/**
 * Lee el contenido del empaque desde el título: "Arroz 1 kg", "Leche 6 x 1.100 ml",
 * "Cerveza 330 ml x 6", "Papel higiénico x 12 rollos", "Aceite 2,5 L". Devuelve el total en
 * unidad base o `null` si no lo encuentra.
 */
export function parseSize(title: string): Size | null {
  const t = norm(title).replace(/×/g, 'x');
  const pack = new RegExp(`(?:^|\\s)(\\d+)\\s*x\\s*${NUM}\\s*${UNIT}(?=\\s|$)`).exec(t);
  if (pack?.[2] && pack[3]) return toBase(Number(pack[1]) * parseAmount(pack[2]), pack[3]);
  const packAfter = new RegExp(`${NUM}\\s*${UNIT}\\s*x\\s*(\\d+)(?=\\s|$)`).exec(t);
  if (packAfter?.[1] && packAfter[2])
    return toBase(parseAmount(packAfter[1]) * Number(packAfter[3]), packAfter[2]);
  const single = new RegExp(`(?:^|\\s)${NUM}\\s*${UNIT}(?=\\s|$)`).exec(t);
  if (single?.[1] && single[2]) return toBase(parseAmount(single[1]), single[2]);
  // "x 12 rollos", "50 unidades" o "x30" (sin palabra solo desde 3: "X2" suele ser un modelo).
  const worded =
    new RegExp(`(?:^|\\s)x\\s*(\\d+)\\s*${COUNT}(?=\\s|$)`).exec(t) ??
    new RegExp(`(?:^|\\s)(\\d+)\\s*${COUNT}(?=\\s|$)`).exec(t);
  if (worded && Number(worded[1]) > 0) return { amount: Number(worded[1]), unit: 'u' };
  const bare = /(?:^|\s)x\s*(\d+)(?=\s|$)/.exec(t);
  if (bare && Number(bare[1]) >= 3) return { amount: Number(bare[1]), unit: 'u' };
  return null;
}

export interface UnitPrice {
  value: number;
  /** Etiqueta de la unidad: kg, L o unidad. */
  per: 'kg' | 'L' | 'unidad';
}

const PER: Record<BaseUnit, { factor: number; per: UnitPrice['per'] }> = {
  g: { factor: 1000, per: 'kg' },
  ml: { factor: 1000, per: 'L' },
  u: { factor: 1, per: 'unidad' },
};

/** Precio por kg, por litro o por unidad (redondeado al peso). */
export function unitPrice(price: number, size: Size | null | undefined): UnitPrice | null {
  if (!size || !(size.amount > 0) || !(price > 0)) return null;
  const { factor, per } = PER[size.unit];
  return { value: Math.round((price / size.amount) * factor), per };
}

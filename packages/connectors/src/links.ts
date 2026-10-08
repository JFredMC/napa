/**
 * Enlaces de salida a las tiendas: búsqueda pública para personas y capa de afiliados.
 *
 * Ñapa no trae ningún ID de afiliado en el código. Cada tienda toma su regla de la
 * configuración (variables `NAPA_AFF_<TIENDA>`), con uno de dos formatos:
 *
 * - **Plantilla de deeplink** (redes como Admitad o Awin, o el generador de la tienda): una URL
 *   con `{url}` (URL de destino codificada) o `{rawUrl}`. Ej.:
 *   `https://ad.admitad.com/g/abc123/?ulp={url}` o
 *   `https://www.awin1.com/cread.php?awinmid=111&awinaffid=222&ued={url}`.
 * - **Parámetros** que se agregan a la URL de la tienda: `utm_source=napa&ref=XYZ`.
 *
 * Sin regla, el enlace va directo a la tienda (sin afiliado) y así se informa.
 */

export type AffiliateRules = Partial<Record<string, string>>;

export interface OutboundLink {
  href: string;
  /** El enlace lleva el código de afiliado de Ñapa. */
  affiliate: boolean;
}

/** Búsqueda pública de cada tienda, para una persona (Ñapa no consulta estas páginas). */
const SEARCH: Record<string, (q: string) => string> = {
  mercadolibre: (q) => `https://listado.mercadolibre.com.co/${slug(q)}`,
  exito: (q) => `https://www.exito.com/s?q=${enc(q)}`,
  carulla: (q) => `https://www.carulla.com/s?q=${enc(q)}`,
  jumbo: (q) => `https://www.jumbocolombia.com/${enc(q)}?_q=${enc(q)}&map=ft`,
  olimpica: (q) => `https://www.olimpica.com/${enc(q)}?_q=${enc(q)}&map=ft`,
  d1: (q) => `https://www.d1.com.co/search?name=${enc(q)}`,
  alkosto: (q) => `https://www.alkosto.com/search?text=${enc(q)}`,
  falabella: (q) => `https://www.falabella.com.co/falabella-co/search?Ntt=${enc(q)}`,
  shein: (q) => `https://www.shein.com.co/pdsearch/${enc(q)}/`,
  temu: (q) => `https://www.temu.com/search_result.html?search_key=${enc(q)}`,
};

/** Programas de afiliados que operan para Colombia (revisado oct. 2026). */
export interface AffiliateProgram {
  storeId: string;
  program: string;
  signup: string;
  /** Cómo se arma el enlace y qué valor configurar. */
  howTo: string;
}

export const AFFILIATE_PROGRAMS: readonly AffiliateProgram[] = [
  {
    storeId: 'mercadolibre',
    program: 'Programa de Afiliados de Mercado Libre Colombia',
    signup: 'https://listado.mercadolibre.com.co/programa-de-afiliados',
    howTo:
      'Los enlaces salen del Portal de Afiliados (generador de links o barra de afiliados). Si el portal permite añadir tu etiqueta como parámetros, configura NAPA_AFF_MERCADOLIBRE con ellos (sin "?"); si solo da enlaces cortos, Ñapa enlaza directo y el canal usa tus enlaces generados.',
  },
  {
    storeId: 'falabella',
    program: 'Creators F (programa propio de Falabella)',
    signup: 'https://www.falabella.com.co/falabella-co/page/creators',
    howTo:
      'Pide redes sociales activas; los enlaces se generan en su plataforma (máx. 30 activos). Si te dan un formato de deeplink, configúralo como plantilla con {url}.',
  },
  {
    storeId: 'shein',
    program: 'SHEIN vía Admitad (incluye Colombia)',
    signup: 'https://www.admitad.com/',
    howTo:
      'En Admitad, une tu sitio al programa SHEIN y copia el deeplink base: NAPA_AFF_SHEIN="https://ad.admitad.com/g/TU_CODIGO/?ulp={url}".',
  },
  {
    storeId: 'temu',
    program: 'Temu Affiliate Program (Colombia es elegible)',
    signup: 'https://www.temu.com/affiliate_question.html',
    howTo:
      'Temu da enlaces y códigos desde su panel. Si te entrega un deeplink con la URL de destino, úsalo como plantilla con {url}; si no, deja Temu sin afiliado.',
  },
];

function enc(s: string): string {
  return encodeURIComponent(s.trim());
}

function slug(s: string): string {
  return (
    s
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'ofertas'
  );
}

/** Búsqueda de `q` en la tienda; si no hay patrón conocido, su página principal. */
export function storeSearchUrl(storeId: string, q: string, website?: string): string | null {
  const build = SEARCH[storeId];
  if (build && q.trim()) return build(q);
  return website ?? null;
}

/** Valida y aplica la regla de afiliado de una tienda a una URL de esa tienda. */
export function withAffiliate(url: string, rule: string | undefined | null): OutboundLink {
  const r = rule?.trim();
  if (!r || !/^https?:\/\//.test(url)) return { href: url, affiliate: false };
  if (/^https:\/\//.test(r)) {
    if (!r.includes('{url}') && !r.includes('{rawUrl}')) return { href: url, affiliate: false };
    return {
      href: r.replaceAll('{url}', encodeURIComponent(url)).replaceAll('{rawUrl}', url),
      affiliate: true,
    };
  }
  // Parámetros: solo pares clave=valor, para no inyectar nada raro en la URL.
  const params = new URLSearchParams(r.replace(/^[?&]/, ''));
  if ([...params.keys()].length === 0) return { href: url, affiliate: false };
  const out = new URL(url);
  params.forEach((value, key) => out.searchParams.set(key, value));
  return { href: out.toString(), affiliate: true };
}

/** Lee las reglas de afiliado desde variables `NAPA_AFF_<TIENDA>` (o `AFF_<TIENDA>`). */
export function affiliateRulesFromEnv(
  env: Record<string, string | undefined>,
  storeIds: readonly string[],
): AffiliateRules {
  const rules: AffiliateRules = {};
  for (const id of storeIds) {
    const key = id.toUpperCase();
    const value = env[`NAPA_AFF_${key}`] ?? env[`AFF_${key}`];
    if (value?.trim()) rules[id] = value.trim();
  }
  return rules;
}

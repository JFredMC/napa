import { norm, type CategoryId } from '@napa/deals-engine';

const RULES: [RegExp, CategoryId][] = [
  [/mascota|perro|gato|concentrado/, 'mascotas'],
  // Frescos y droguería antes que el resto: sus nombres chocan con otras reglas ("forte", "agua de rosas").
  [/\b(carne|pollo|pescado|filete|fruta|verdura|fruver|panaderia)/, 'despensa'],
  [/\b(salud|drogueria|medicamento|botiquin|vitamina)/, 'cuidado-personal'],
  [/\b(papeleria|libro|escolar)/, 'hogar'],
  [/lacteo|leche|huevo|queso|yogur|kumis|mantequilla/, 'lacteos'],
  [/\b(bebida|gaseosa|jugo|agua\b|cerveza|licor|vino\b|cafe listo|te\b|aromatica)/, 'bebidas'],
  [/bebe|panal|toallita|infantil/, 'bebe'],
  [
    /aseo|limpieza|detergente|lavaloza|suavizante|papel higienico|desinfect|hogar y limpieza/,
    'aseo-hogar',
  ],
  [/cuidado personal|shampoo|jabon|crema dental|desodorante|higiene/, 'cuidado-personal'],
  [/belleza|maquillaje|dermo|facial|perfume/, 'belleza'],
  [
    /tecnologia|celular|computador|portatil|televisor|audio|video|consola|tablet|smartwatch/,
    'tecnologia',
  ],
  [
    /electrodomestico|electrohogar|licuadora|freidora|cafetera|nevera|lavadora|cocina electr/,
    'electrohogar',
  ],
  [/moda|ropa|calzado|zapato|tenis|vestuario/, 'moda'],
  [/hogar|cama|bano|decoracion|menaje|muebles/, 'hogar'],
  [
    /mercado|despensa|supermercado|abarrote|granos|aceite|arroz|pasta|enlatado|snack|dulce/,
    'despensa',
  ],
];

function match(text: string): CategoryId | null {
  const t = ` ${norm(text.replace(/\//g, ' '))} `;
  for (const [re, id] of RULES) if (re.test(t)) return id;
  return null;
}

/**
 * Traduce la ruta de categorías de una tienda ("/Mercado/Despensa/Arroz/") a una de Ñapa.
 * Prueba primero la categoría más específica, luego las generales y por último el título.
 */
export function mapCategory(paths: readonly string[], title = ''): CategoryId {
  const ordered = [...paths].sort((a, b) => b.split('/').length - a.split('/').length);
  for (const path of ordered) {
    const segments = path.split('/').filter(Boolean).reverse();
    for (const seg of segments) {
      const hit = match(seg);
      // "Supermercado" o "Mercado" solos son demasiado generales: mejor mirar el título.
      if (hit && !/^(super)?mercado$/.test(norm(seg))) return hit;
    }
  }
  return match(title) ?? 'despensa';
}

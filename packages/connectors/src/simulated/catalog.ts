import type { CategoryId } from '@napa/deals-engine';

/**
 * Catálogo FICTICIO para la demo. Las marcas son inventadas a propósito y los precios base son
 * aproximaciones razonables en COP: sirven para mostrar cómo funciona Ñapa, no para comprar.
 */
export interface ProductTemplate {
  key: string;
  title: string;
  brand: string;
  category: CategoryId;
  /** Precio de referencia en COP. */
  base: number;
  /** Tiendas que lo venden (si se omite, todas las que manejan la categoría). */
  stores?: readonly string[];
}

const p = (key: string, title: string, brand: string, category: CategoryId, base: number, stores?: string[]): ProductTemplate => ({
  key,
  title,
  brand,
  category,
  base,
  ...(stores ? { stores } : {}),
});

const SUPER = ['exito', 'carulla', 'jumbo', 'olimpica', 'd1', 'ara'];
const BIG = ['exito', 'jumbo', 'olimpica', 'alkosto', 'falabella', 'mercadolibre'];

export const CATALOG: readonly ProductTemplate[] = [
  // Despensa
  p('arroz-1kg', 'Arroz blanco 1 kg', 'La Cosecha', 'despensa', 4300, [...SUPER, 'alkosto']),
  p('arroz-5kg', 'Arroz blanco 5 kg', 'La Cosecha', 'despensa', 19900, [...SUPER, 'alkosto', 'mercadolibre']),
  p('aceite-3l', 'Aceite de girasol 3 L', 'Brisa del Valle', 'despensa', 27900, [...SUPER, 'alkosto', 'mercadolibre']),
  p('aceite-1l', 'Aceite vegetal 1 L', 'Brisa del Valle', 'despensa', 9800, SUPER),
  p('atun-3x160', 'Atún lomitos en agua 3 x 160 g', 'Mar Azul', 'despensa', 16500, [...SUPER, 'mercadolibre']),
  p('frijol-500', 'Fríjol cargamanto 500 g', 'Campo Verde', 'despensa', 7800, SUPER),
  p('lenteja-500', 'Lenteja 500 g', 'Campo Verde', 'despensa', 3900, SUPER),
  p('pasta-1kg', 'Pasta spaghetti 1 kg', 'Doña Pepa', 'despensa', 6200, SUPER),
  p('cafe-500', 'Café molido tostión media 500 g', 'Montaña Alta', 'despensa', 19800, [...SUPER, 'mercadolibre']),
  p('cafe-grano-1kg', 'Café en grano 1 kg', 'Montaña Alta', 'despensa', 52900, ['exito', 'carulla', 'jumbo', 'mercadolibre']),
  p('chocolate-500', 'Chocolate de mesa 500 g', 'Cacao Real', 'despensa', 9600, SUPER),
  p('azucar-2500', 'Azúcar blanca 2,5 kg', 'Dulce Valle', 'despensa', 11900, SUPER),
  p('panela-2lb', 'Panela redonda 2 libras', 'Trapiche Viejo', 'despensa', 5200, SUPER),
  p('harina-1kg', 'Harina de maíz precocida 1 kg', 'Arepa Dorada', 'despensa', 4600, SUPER),
  p('avena-1kg', 'Avena en hojuelas 1 kg', 'Campo Verde', 'despensa', 7400, SUPER),
  p('galletas-12', 'Galletas de soda x 12 paquetes', 'Crujiditas', 'despensa', 8900, SUPER),
  // Lácteos y huevos
  p('leche-6x1100', 'Leche entera 6 x 1.100 ml', 'Pradera', 'lacteos', 23500, [...SUPER, 'mercadolibre']),
  p('leche-deslac-1100', 'Leche deslactosada 1.100 ml', 'Pradera', 'lacteos', 4600, SUPER),
  p('huevos-30', 'Huevos rojos AA x 30 unidades', 'Granja Sol', 'lacteos', 17900, SUPER),
  p('yogur-1l', 'Yogur de fresa 1 L', 'Pradera', 'lacteos', 7900, SUPER),
  p('queso-500', 'Queso campesino 500 g', 'Vaquita Feliz', 'lacteos', 13900, SUPER),
  p('mantequilla-250', 'Mantequilla con sal 250 g', 'Vaquita Feliz', 'lacteos', 8400, SUPER),
  // Bebidas
  p('agua-6x600', 'Agua sin gas 6 x 600 ml', 'Manantial', 'bebidas', 8900, [...SUPER, 'mercadolibre']),
  p('gaseosa-2x1500', 'Gaseosa cola 2 x 1,5 L', 'Burbuja', 'bebidas', 9900, SUPER),
  p('jugo-1l', 'Jugo de naranja 1 L', 'Huerta', 'bebidas', 5600, SUPER),
  p('cerveza-6x330', 'Cerveza rubia 6 x 330 ml', 'Cumbre', 'bebidas', 16900, SUPER),
  p('te-frio-6x400', 'Té frío limón 6 x 400 ml', 'Hoja Fresca', 'bebidas', 12900, SUPER),
  // Aseo del hogar
  p('detergente-3l', 'Detergente líquido 3 L', 'Brillo', 'aseo-hogar', 32900, [...SUPER, 'alkosto', 'mercadolibre']),
  p('detergente-polvo-2kg', 'Detergente en polvo 2 kg', 'Brillo', 'aseo-hogar', 21900, [...SUPER, 'alkosto']),
  p('papel-12', 'Papel higiénico doble hoja x 12 rollos', 'Suave Nube', 'aseo-hogar', 21900, [...SUPER, 'alkosto', 'mercadolibre']),
  p('lavaloza-1kg', 'Lavaloza en crema 1 kg', 'Brillo', 'aseo-hogar', 9800, SUPER),
  p('suavizante-2l', 'Suavizante de ropa 2 L', 'Brisa Fresca', 'aseo-hogar', 14900, SUPER),
  p('limpiador-1l', 'Limpiador multiusos lavanda 1 L', 'Brisa Fresca', 'aseo-hogar', 6900, SUPER),
  p('bolsas-30', 'Bolsas para basura x 30 unidades', 'Fuerte', 'aseo-hogar', 7900, [...SUPER, 'mercadolibre']),
  // Cuidado personal
  p('shampoo-750', 'Shampoo hidratante 750 ml', 'Selva', 'cuidado-personal', 21900, [...SUPER, 'mercadolibre']),
  p('crema-dental-3x100', 'Crema dental 3 x 100 ml', 'Sonrisa', 'cuidado-personal', 15900, [...SUPER, 'mercadolibre']),
  p('jabon-6', 'Jabón de tocador x 6 unidades', 'Selva', 'cuidado-personal', 12900, SUPER),
  p('desodorante-150', 'Desodorante en aerosol 150 ml', 'Activo', 'cuidado-personal', 14900, [...SUPER, 'mercadolibre']),
  // Bebé
  p('panales-50', 'Pañales etapa 3 x 50 unidades', 'Nube Kids', 'bebe', 54900, [...SUPER, 'mercadolibre']),
  p('toallitas-100', 'Toallitas húmedas x 100 unidades', 'Nube Kids', 'bebe', 11900, [...SUPER, 'mercadolibre']),
  // Mascotas
  p('perro-8kg', 'Concentrado para perro adulto 8 kg', 'Can Feliz', 'mascotas', 89900, ['exito', 'jumbo', 'olimpica', 'alkosto', 'mercadolibre', 'd1']),
  p('gato-3kg', 'Concentrado para gato 3 kg', 'Michi', 'mascotas', 46900, ['exito', 'carulla', 'jumbo', 'alkosto', 'mercadolibre']),
  p('arena-4500', 'Arena para gato 4,5 kg', 'Michi', 'mascotas', 21900, ['exito', 'jumbo', 'mercadolibre', 'ara']),
  // Tecnología
  p('audifonos-x2', 'Audífonos inalámbricos con cancelación de ruido Air X2', 'Sonora', 'tecnologia', 189900, [...BIG, 'temu']),
  p('celular-128', 'Celular Nova 5 128 GB 6 GB RAM', 'Nova', 'tecnologia', 899900, BIG),
  p('tv-55', 'Televisor 55 pulgadas 4K UHD Smart', 'Visio', 'tecnologia', 1899900, BIG),
  p('portatil-14', 'Portátil 14 pulgadas 16 GB RAM 512 GB SSD', 'Lumen', 'tecnologia', 2499900, ['exito', 'alkosto', 'falabella', 'mercadolibre']),
  p('parlante-bt', 'Parlante bluetooth resistente al agua 20 W', 'Sonora', 'tecnologia', 159900, [...BIG, 'temu']),
  p('smartwatch', 'Reloj inteligente con GPS Pulse 3', 'Pulse', 'tecnologia', 329900, [...BIG, 'temu']),
  p('cargador-65w', 'Cargador USB-C 65 W', 'Volt', 'tecnologia', 79900, ['alkosto', 'falabella', 'mercadolibre', 'temu']),
  p('mouse-inal', 'Mouse inalámbrico silencioso', 'Volt', 'tecnologia', 49900, ['exito', 'alkosto', 'falabella', 'mercadolibre', 'temu']),
  // Electrohogar
  p('freidora-5l', 'Freidora de aire digital 5 L', 'Calora', 'electrohogar', 349900, BIG),
  p('licuadora', 'Licuadora 10 velocidades 1,5 L', 'Calora', 'electrohogar', 189900, BIG),
  p('cafetera', 'Cafetera de goteo 12 tazas', 'Calora', 'electrohogar', 129900, BIG),
  p('aspiradora-robot', 'Aspiradora robot con mapeo', 'Limpia', 'electrohogar', 1199900, ['exito', 'alkosto', 'falabella', 'mercadolibre']),
  p('ventilador', 'Ventilador de pie 18 pulgadas', 'Brisa', 'electrohogar', 169900, ['exito', 'jumbo', 'olimpica', 'alkosto', 'mercadolibre']),
  p('olla-arrocera', 'Olla arrocera 1,8 L', 'Calora', 'electrohogar', 139900, BIG),
  // Hogar
  p('sabanas-doble', 'Juego de sábanas doble 144 hilos', 'Descanso', 'hogar', 119900, ['exito', 'carulla', 'falabella', 'mercadolibre', 'shein']),
  p('sarten-24', 'Sartén antiadherente 24 cm', 'Cocina Viva', 'hogar', 69900, ['exito', 'jumbo', 'alkosto', 'falabella', 'mercadolibre', 'temu']),
  p('toallas-2', 'Toallas de baño x 2 unidades', 'Descanso', 'hogar', 59900, ['exito', 'falabella', 'mercadolibre', 'shein', 'temu']),
  p('organizador', 'Organizador plegable de tela x 3 unidades', 'Orden', 'hogar', 45900, ['mercadolibre', 'shein', 'temu', 'falabella']),
  p('lampara-led', 'Lámpara de escritorio LED recargable', 'Lumen', 'hogar', 89900, ['alkosto', 'falabella', 'mercadolibre', 'temu']),
  // Moda
  p('tenis-running', 'Tenis para correr hombre', 'Zancada', 'moda', 289900, ['falabella', 'mercadolibre', 'shein', 'exito']),
  p('camisetas-3', 'Camiseta básica algodón x 3 unidades', 'Básicos', 'moda', 89900, ['falabella', 'mercadolibre', 'shein', 'temu', 'exito']),
  p('jean-mujer', 'Jean tiro alto mujer', 'Índigo', 'moda', 149900, ['falabella', 'mercadolibre', 'shein']),
  p('chaqueta', 'Chaqueta rompevientos impermeable', 'Zancada', 'moda', 219900, ['falabella', 'mercadolibre', 'shein', 'temu']),
  p('vestido', 'Vestido midi estampado', 'Flor de Mayo', 'moda', 129900, ['falabella', 'shein', 'temu']),
  // Belleza
  p('protector-50', 'Protector solar facial FPS 50 50 ml', 'Sol y Piel', 'belleza', 69900, ['falabella', 'mercadolibre', 'shein', 'exito', 'carulla']),
  p('serum', 'Sérum de vitamina C 30 ml', 'Sol y Piel', 'belleza', 79900, ['falabella', 'mercadolibre', 'shein', 'temu']),
  p('labial', 'Labial mate larga duración', 'Carmín', 'belleza', 34900, ['falabella', 'mercadolibre', 'shein', 'temu']),
  p('paleta-sombras', 'Paleta de sombras 18 tonos', 'Carmín', 'belleza', 59900, ['falabella', 'mercadolibre', 'shein', 'temu']),
];

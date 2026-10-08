import { describe, expect, it } from 'vitest';
import { isAllowedByRobots } from './robots';

// Fragmentos con la forma de los robots.txt de las tiendas (oct. 2026).
const EXITO = `User-agent: *
Allow: /
Disallow: /account/
Disallow: /s?
Disallow: /*?*sort=
# APIs
Disallow: /api/`;

const JUMBO = `User-agent: *
Allow: /*.css
Disallow: /busca*
Disallow: /checkout/
Disallow: /?*fq`;

const UA = 'NapaBot/0.1 (+https://github.com/JFredMC/napa)';

describe('robots.txt', () => {
  it('Éxito y Carulla prohíben /api/', () => {
    expect(isAllowedByRobots(EXITO, UA, '/api/catalog_system/pub/products/search?ft=arroz')).toBe(false);
    expect(isAllowedByRobots(EXITO, UA, '/arroz-blanco/p')).toBe(true);
    expect(isAllowedByRobots(EXITO, UA, '/s?q=arroz')).toBe(false);
    expect(isAllowedByRobots(EXITO, UA, '/mercado?page=2&sort=price')).toBe(false);
  });

  it('Jumbo bloquea /busca pero no la API de catálogo', () => {
    expect(isAllowedByRobots(JUMBO, UA, '/api/catalog_system/pub/products/search?ft=arroz')).toBe(true);
    expect(isAllowedByRobots(JUMBO, UA, '/busca?ft=arroz')).toBe(false);
    expect(isAllowedByRobots(JUMBO, UA, '/?fq=C:1')).toBe(false);
  });

  it('grupo específico, regla más larga y $', () => {
    const robots = `User-agent: *
Disallow: /

User-agent: napabot
Disallow: /privado
Allow: /privado/publico
Disallow: /*.pdf$`;
    expect(isAllowedByRobots(robots, 'OtroBot/1.0', '/x')).toBe(false);
    expect(isAllowedByRobots(robots, UA, '/x')).toBe(true);
    expect(isAllowedByRobots(robots, UA, '/privado/a')).toBe(false);
    expect(isAllowedByRobots(robots, UA, '/privado/publico/a')).toBe(true);
    expect(isAllowedByRobots(robots, UA, '/doc.pdf')).toBe(false);
    expect(isAllowedByRobots(robots, UA, '/doc.pdf?x=1')).toBe(true);
  });

  it('sin reglas o Disallow vacío permite todo', () => {
    expect(isAllowedByRobots('', UA, '/api/')).toBe(true);
    expect(isAllowedByRobots('User-agent: *\nDisallow:', UA, '/api/')).toBe(true);
  });
});

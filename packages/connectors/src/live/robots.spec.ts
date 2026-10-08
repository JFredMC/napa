import { describe, expect, it } from 'vitest';
import { isAllowedByRobots } from './robots';

// Fragmentos con la forma real de los robots.txt (oct. 2026). En el de Éxito/Carulla las reglas
// quedan debajo del último User-agent (un bot de IA): estrictamente, `*` solo tiene "Allow: /".
const EXITO = `User-agent: *
Allow: /

User-agent: Applebot-Extended
Allow: /
# Áreas privadas / no indexables
Disallow: /account/
Disallow: /s?
# APIs
Disallow: /api/`;

const JUMBO = `User-agent: *
Allow: /*.css
Disallow: /busca*
Disallow: /checkout/
Disallow: /?*fq`;

const OLIMPICA = `User-agent: *
Disallow: /secret
Allow: /*.css
User-agent: *
Disallow: /*&
Disallow: /*%
User-agent: Googlebot
Allow: /*`;

const UA = 'NapaBot/0.1 (+https://github.com/JFredMC/napa)';

describe('robots.txt', () => {
  it('Éxito/Carulla: leído al pie de la letra, /api/ solo se prohíbe a Applebot-Extended', () => {
    // Por eso Ñapa además aplica `respectDisallow: ['/api/']` en esas tiendas (ver stores.ts).
    expect(isAllowedByRobots(EXITO, UA, '/api/catalog_system/pub/products/search?ft=arroz')).toBe(
      true,
    );
    expect(
      isAllowedByRobots(
        EXITO,
        'Applebot-Extended',
        '/api/catalog_system/pub/products/search?ft=arroz',
      ),
    ).toBe(false);
  });

  it('Olímpica: grupos `*` repetidos se combinan; prohíbe URLs con "&" o "%"', () => {
    expect(
      isAllowedByRobots(
        OLIMPICA,
        UA,
        '/api/catalog_system/pub/products/search?ft=arroz&_from=0&_to=9',
      ),
    ).toBe(false);
    expect(
      isAllowedByRobots(OLIMPICA, UA, '/api/catalog_system/pub/products/search?ft=at%C3%BAn'),
    ).toBe(false);
    expect(
      isAllowedByRobots(OLIMPICA, UA, '/api/catalog_system/pub/products/search?ft=arroz+blanco'),
    ).toBe(true);
    expect(isAllowedByRobots(OLIMPICA, 'Googlebot/2.1', '/a&b')).toBe(true);
  });

  it('Jumbo bloquea /busca pero no la API de catálogo', () => {
    expect(isAllowedByRobots(JUMBO, UA, '/api/catalog_system/pub/products/search?ft=arroz')).toBe(
      true,
    );
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

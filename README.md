<p align="center">
  <img src="apps/web/public/favicon.svg" width="72" alt="Ñapa" />
</p>

<h1 align="center">Ñapa</h1>

<p align="center">
  <b>Las ofertas que sí son ofertas.</b><br />
  Buscador y recomendador de ofertas para Colombia: compara tiendas, detecta descuentos inflados con el historial
  de precios, calcula el precio por kilo o litro y reparte tu mercado entre tiendas para pagar menos.
</p>

<p align="center">
  <a href="https://jfredmc.github.io/napa/"><b>Ver la demo</b></a> ·
  <a href="#fuentes-qué-es-real-y-qué-es-simulado">Fuentes</a> ·
  <a href="#cómo-decide">Cómo decide</a> ·
  <a href="#desarrollo">Desarrollo</a>
</p>

<p align="center">
  <a href="https://github.com/JFredMC/napa/actions/workflows/ci.yml"><img src="https://github.com/JFredMC/napa/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/JFredMC/napa/actions/workflows/e2e-live.yml"><img src="https://github.com/JFredMC/napa/actions/workflows/e2e-live.yml/badge.svg" alt="E2E en vivo" /></a>
</p>

![Ofertas de hoy](docs/screenshots/desktop-dark-ofertas.png)

> **La demo usa precios simulados.** En GitHub Pages no hay backend: los precios, productos y marcas son
> ficticios y así se marcan en cada oferta (`Simulado`). Las tiendas y las sedes del mapa sí son reales. Ñapa no
> vende nada ni tiene relación con las tiendas.

## Qué hace

- **Puntaje de 0 a 100 por oferta**: ahorro real, precio frente a otras tiendas (con envío), historial, confianza de la tienda y envío.
- **Detector de descuentos inflados**: compara el precio “antes” con lo que de verdad se cobró en los últimos 90 días. Si el “antes” nunca se cobró, o el precio de hoy es el de siempre, la oferta se marca como inflada y su puntaje queda en máximo 30.
- **Historial de precios** de 120 días con el precio habitual y el “antes” anunciado sobre la gráfica.
- **Mismo producto en todas las tiendas**: precio, descuento, precio por unidad, envío, total puesto en casa y veredicto.
- **Precio por kilo, litro o unidad** que entiende presentaciones colombianas (`6 x 1.100 ml`, `x 160g x 4und`, `paca x 12`).
- **Top de hoy** y mejores ofertas por categoría, sin descuentos inflados ni dudosos.
- **Búsqueda y filtros** en la URL: tiendas, descuento mínimo, ocultar inflados, ordenar por puntaje, precio, descuento, ahorro o precio por unidad.
- **Lista de compras optimizada**: reparte la lista entre 1, 2 o 3 tiendas para pagar lo menos posible con envíos, y muestra cuánto falta para envío gratis.
- **Alertas de precio y favoritos** guardados en el navegador; las alertas cumplidas se marcan en la barra.
- **Tiendas cerca de ti** (solo si das permiso): sedes de OpenStreetMap vía Overpass, mapa MapLibre con estilos de CARTO (sin llaves) y las ofertas de cada cadena cercana.
- **Página de fuentes** que explica, tienda por tienda, qué es real, qué es simulado y por qué.
- Tema claro y oscuro, versión móvil con barra inferior, formato colombiano (`$4.300`, `12 %`).

| Descuento inflado                                                         | Lista de compras                                  |
| ------------------------------------------------------------------------- | ------------------------------------------------- |
| ![Descuento inflado](docs/screenshots/desktop-dark-descuento-inflado.png) | ![Lista](docs/screenshots/desktop-dark-lista.png) |

| Tiendas cerca                                     | Fuentes                                               |
| ------------------------------------------------- | ----------------------------------------------------- |
| ![Cerca](docs/screenshots/desktop-dark-cerca.png) | ![Fuentes](docs/screenshots/desktop-dark-fuentes.png) |

| Móvil                                                         | Producto en móvil                                               | Cerca en móvil                                            | Tema claro                                                |
| ------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------- |
| ![Ofertas en móvil](docs/screenshots/mobile-dark-ofertas.png) | ![Producto en móvil](docs/screenshots/mobile-dark-producto.png) | ![Cerca en móvil](docs/screenshots/mobile-dark-cerca.png) | ![Tema claro](docs/screenshots/desktop-light-ofertas.png) |

## Fuentes: qué es real y qué es simulado

Ñapa tiene un adaptador por tienda detrás de una interfaz común (`StoreConnector`). Solo hay adaptadores reales donde existe acceso público u oficial, y corren en el **backend local** (nunca en el navegador ni en Pages).

| Tienda                                   | Adaptador real                  | Con el backend local         | Por qué                                                                                        |
| ---------------------------------------- | ------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------- |
| Jumbo                                    | Catálogo público VTEX           | **En vivo**                  | Su robots.txt no prohíbe la API de catálogo.                                                   |
| Olímpica                                 | Catálogo público VTEX           | **En vivo**                  | Su robots.txt prohíbe URLs con `&` o `%`: se consulta `?ft=palabra` y se filtra en el backend. |
| Mercado Libre                            | API oficial (OAuth)             | En vivo **con credenciales** | Sin token de una app registrada responde 403.                                                  |
| Éxito, Carulla                           | Catálogo público VTEX (apagado) | Simulada                     | Su robots.txt declara `Disallow: /api/`; Ñapa respeta la intención.                            |
| D1, Ara, Alkosto, Falabella, Shein, Temu | —                               | Simulada                     | Sin API pública de catálogo. **No se hace scraping.**                                          |

Reglas del backend: revisa `robots.txt` antes de cada dominio (y no consulta si no lo puede leer), una petición cada 1,5 s por tienda, caché de 10 minutos, 60 peticiones por minuto por cliente, User-Agent que se identifica, y si una fuente falla esa tienda vuelve al simulado y la respuesta lo dice. Los precios reales solo se comparan con precios reales.

**Qué haría falta para salir en vivo**

1. **Hosting** para `apps/api` (un contenedor pequeño en Render, Fly.io o Railway) y su URL en `apps/web/src/environments/environment.ts` (`apiUrl`). La app muestra entonces el selector Demo/API.
2. **Mercado Libre**: registrar una app en developers.mercadolibre.com.co y configurar `ML_CLIENT_ID`, `ML_CLIENT_SECRET` y `ML_REFRESH_TOKEN`.
3. **Éxito y Carulla**: permiso o acuerdo de datos. **D1, Ara, Alkosto, Falabella, Shein y Temu**: convenio, feed de afiliados o API oficial.
4. Una base de datos para el historial de precios observado (hoy vive en memoria del backend).

## Cómo decide

Todo vive en [`packages/deals-engine`](packages/deals-engine): TypeScript puro, sin dependencias y con pruebas.

| Concepto          | Regla                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Precio habitual   | Mediana de los precios de hace 90 a 8 días (se necesitan al menos 21 días de historial)                                               |
| Descuento real    | `1 − hoy / habitual`; “mínimo de 90 días” si además es el precio más bajo del periodo                                                 |
| Descuento inflado | El “antes” anunciado nunca se cobró en 90 días (5 % de margen), o el precio de hoy no baja del habitual                               |
| Dudoso            | Anuncia 60 % o más y no hay historial para comprobarlo                                                                                |
| Puntaje           | Ahorro real 35 · frente a otras tiendas con envío 25 · historial 15 · confianza de la tienda 15 · envío 10; inflado ≤ 30, dudoso ≤ 50 |
| Precio por unidad | Lee el tamaño del título (`kg`, `g`, `L`, `ml`, `und`, multipacks) y lo lleva a kilo, litro o unidad                                  |
| Mismo producto    | Agrupa por marca, tamaño y palabras del título entre tiendas                                                                          |
| Lista de compras  | Prueba las combinaciones de hasta 3 tiendas (más búsqueda local) con envío por tienda y envío gratis desde cierto monto               |

Los datos simulados son deterministas por día: mismas marcas ficticias, 120 días de historial y cuatro escenarios por oferta (promoción real, “antes” inflado que nunca se cobró, subida antes de la rebaja o precio normal).

## Arquitectura

```
napa/
├── packages/deals-engine   Motor: precio por unidad, historial, descuentos, puntaje, ranking, lista, alertas, geo
├── packages/connectors     Interfaz StoreConnector, un adaptador por tienda (VTEX, Mercado Libre, simulados)
├── apps/api                NestJS 11, solo local: proxy CORS, robots.txt, caché, límite de ritmo, historial
└── apps/web                Angular 22: standalone, signals, zoneless, OnPush
    ├── core/               Catálogo (demo o API), listas, ubicación, tema, formato
    ├── shared/             Tarjeta de oferta, gráfica SVG propia, distintivos
    └── features/           ofertas · producto · lista · guardados · cerca · fuentes
```

- Demo sin backend en GitHub Pages (`base href` `/napa/` y `404.html` para las rutas). MapLibre se carga solo en “Cerca”.
- La ubicación solo se pide al tocar el botón, se usa una vez para consultar Overpass y no se guarda.
- Favoritos, alertas y lista quedan en `localStorage`.

## Desarrollo

Requisitos: Node 22 y pnpm 10.

```bash
pnpm install
pnpm --filter @napa/deals-engine build && pnpm --filter @napa/connectors build
pnpm --filter @napa/web start                 # http://localhost:4200 (con el backend en :3000 aparece el selector Demo/API)

# Backend local (opcional)
cp apps/api/.env.example apps/api/.env        # credenciales de Mercado Libre si las tienes
pnpm --filter @napa/api build && pnpm --filter @napa/api start:prod

pnpm test        # motor y conectores (Vitest), API (Jest), app (Vitest con Angular)
pnpm --filter @napa/api test:e2e
pnpm lint
pnpm typecheck

# E2E con Playwright contra el build de Pages (escritorio y móvil)
pnpm --filter @napa/web build:pages
pnpm --filter @napa/web e2e
# …o contra el sitio en vivo
E2E_BASE_URL=https://jfredmc.github.io/napa/ pnpm --filter @napa/web e2e
```

CI corre formato, lint, typecheck, pruebas, build, la suite E2E de la API y la de la web en cada PR. Después de cada despliegue, la suite web se repite contra el sitio publicado. Las pruebas no tocan tiendas reales: la API usa un `fetch` falso y la web responde Overpass con sedes reales de OpenStreetMap guardadas en `e2e/fixtures`.

## Licencia

MIT © Jhon Maquilon · [JFredDev](https://jfredmc.github.io/portfolio/)

Datos de sedes © colaboradores de [OpenStreetMap](https://www.openstreetmap.org/copyright) (ODbL). Mapas © [CARTO](https://carto.com/attributions). Los nombres de las tiendas son de sus dueños.

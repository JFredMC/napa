# @napa/connectors

Una interfaz común (`StoreConnector`) y un adaptador por tienda.

| Tienda                                   | Adaptador real                              | En la demo | Por qué                                                                                    |
| ---------------------------------------- | ------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------ |
| Jumbo                                    | `createVtexConnector` (VTEX)                | Simulado   | Catálogo público de VTEX; su robots.txt no prohíbe la API. Solo desde el backend.          |
| Olímpica                                 | `createVtexConnector` (VTEX)                | Simulado   | Igual, pero su robots.txt prohíbe URLs con `&` o `%`: se usa `?ft=palabra` sin paginación. |
| Éxito                                    | `createVtexConnector` (apagado)             | Simulado   | Su robots.txt declara `Disallow: /api/`; se respeta (`respectDisallow`).                   |
| Carulla                                  | `createVtexConnector` (apagado)             | Simulado   | Igual que Éxito.                                                                           |
| Mercado Libre                            | `createMercadoLibreConnector` (API oficial) | Simulado   | Requiere token OAuth de una app registrada; sin token responde 403.                        |
| D1, Ara, Alkosto, Falabella, Shein, Temu | —                                           | Simulado   | Sin API pública de catálogo. No se hace scraping.                                          |

Los adaptadores simulados (`src/simulated/stores/*.ts`) generan datos **ficticios** con marcas inventadas, 120 días de historial y tres escenarios por oferta (promo real, descuento inflado o precio normal). Cada oferta lleva `source: 'simulated'` y la interfaz lo muestra.

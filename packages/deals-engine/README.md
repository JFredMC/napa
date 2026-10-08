# @napa/deals-engine

Motor puro de Ñapa (TypeScript, sin dependencias ni IO). Recibe ofertas normalizadas, vengan de una API real o de un adaptador simulado, y devuelve análisis, puntajes, rankings y planes de compra.

| Módulo     | Qué hace                                                                                                              |
| ---------- | --------------------------------------------------------------------------------------------------------------------- |
| `units`    | Lee el contenido del empaque desde el título (`6 x 1.100 ml`, `x 12 rollos`, `2,5 L`) y da precio por kg, L o unidad. |
| `history`  | Estadísticas del historial: mínimo y máximo de 90 días, mediana, precio habitual antes de la promo.                   |
| `discount` | Detecta descuentos inflados: precio "antes" que nunca se cobró o precio actual que no baja del habitual.              |
| `score`    | Puntaje 0–100: ahorro real, frente a otras tiendas (con envío), historial, confianza de la tienda y envío.            |
| `rank`     | Filtros, orden, mejor oferta por producto, top por categoría y comparación del mismo producto entre tiendas.          |
| `match`    | Empareja el mismo producto entre tiendas (marca + tamaño + títulos parecidos).                                        |
| `basket`   | Divide la lista de compras entre tiendas para pagar lo menos posible, envíos y umbrales de envío gratis incluidos.    |
| `alerts`   | Lista de seguimiento con precio objetivo.                                                                             |
| `geo`      | Distancias, reconocimiento de cadenas en OpenStreetMap y consulta Overpass.                                           |

```bash
pnpm --filter @napa/deals-engine test
```

# @napa/api

Backend de Ñapa en NestJS. Corre en el plan gratuito de Render (`https://napa-api.onrender.com`, ver [`render.yaml`](../../render.yaml)) y también en local para desarrollo (`?mode=api`). El historial de precios vive en memoria.

- Proxy CORS (solo `GET`, orígenes en `CORS_ORIGINS`).
- Revisa `robots.txt` de cada tienda antes de pedir nada (24 h de caché; si no se puede leer, no consulta).
- Caché de búsquedas (10 min en local, 1 h en Render) y límite de ritmo: una petición cada 1,5 s por dominio (2 s en Render) y 60 por minuto por cliente.
- Éxito y Carulla: nunca consulta su `/api/` (robots.txt). Solo pide, como mucho cada 12 h y cuando alguien abre `/api/sources`, el sitemap que su robots.txt anuncia, sin leer el cuerpo, para registrar si aceptan robots identificados (8 oct. 2026 desde Render: Éxito `429 rate-limit-reason: bot`, Carulla 200).
- User-Agent que se identifica: `NapaBot/0.1 (+https://github.com/JFredMC/napa)`.
- Historial observado en memoria: con días de uso, la detección de descuentos inflados aplica también a precios reales.
- Si una fuente real falla o está bloqueada, la tienda vuelve al simulado y la respuesta lo dice (`mode: blocked`).

```bash
cp apps/api/.env.example apps/api/.env   # opcional: credenciales de Mercado Libre
pnpm --filter @napa/api build && pnpm --filter @napa/api start:prod
curl "http://localhost:3000/api/search?q=atun%20agua&stores=jumbo,olimpica"
```

| Endpoint           | Qué devuelve                                                                              |
| ------------------ | ----------------------------------------------------------------------------------------- |
| `GET /api/search`  | `q`, `category`, `stores`, `limit` → ofertas (cada una con `source`) y estado por tienda. |
| `GET /api/sources` | Qué tiendas están en vivo, bloqueadas o simuladas, y por qué.                             |
| `GET /api/health`  | `{ status: 'ok' }`                                                                        |

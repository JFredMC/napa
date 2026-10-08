# @napa/api

Backend **local** de Ñapa en NestJS. No se publica: sirve para probar los adaptadores reales desde la app (`?mode=api`).

- Proxy CORS (solo `GET`, orígenes en `CORS_ORIGINS`).
- Revisa `robots.txt` de cada tienda antes de pedir nada (24 h de caché; si no se puede leer, no consulta).
- Caché de búsquedas (10 min) y límite de ritmo: una petición cada 1,5 s por dominio y 60 por minuto por cliente.
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

/**
 * Build de producción (GitHub Pages). El backend NestJS corre en el plan gratuito de Render
 * (ver render.yaml). Si Render asigna otra URL al servicio, cambiarla aquí.
 */
export const environment = {
  apiUrl: 'https://napa-api.onrender.com' as string | null,
};

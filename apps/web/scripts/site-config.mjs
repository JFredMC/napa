// Genera src/site-config.json a partir de variables de entorno NAPA_* (variables del
// repositorio en GitHub Actions). Todo es público (va en el HTML/JS); los secretos de verdad
// (tokens de Telegram, claves de Mercado Libre) viven solo en el backend.
//
// Sin variables, todo queda apagado: sin afiliados, sin anuncios, sin analítica.
import { writeFileSync } from 'node:fs';

const STORES = [
  'mercadolibre',
  'exito',
  'carulla',
  'jumbo',
  'olimpica',
  'd1',
  'ara',
  'alkosto',
  'falabella',
  'shein',
  'temu',
];
const env = process.env;
const warn = (msg) => console.warn(`[site-config] ${msg}`);

function pick(key, re, hint) {
  const v = env[key]?.trim();
  if (!v) return null;
  if (re && !re.test(v)) {
    warn(`${key} ignorada: ${hint}`);
    return null;
  }
  return v;
}

export function buildSiteConfig() {
  let siteUrl =
    pick('NAPA_SITE_URL', /^https:\/\/[^\s]+$/, 'debe empezar por https://') ??
    'https://jfredmc.github.io/napa/';
  if (!siteUrl.endsWith('/')) siteUrl += '/';

  const affiliates = {};
  for (const id of STORES) {
    const v = env[`NAPA_AFF_${id.toUpperCase()}`]?.trim();
    if (!v) continue;
    if (/^https:\/\//.test(v) ? /\{(raw)?url\}/i.test(v) : /^[?&]?[\w.-]+=[^\s]*$/.test(v))
      affiliates[id] = v;
    else
      warn(
        `NAPA_AFF_${id.toUpperCase()} ignorada: usa una plantilla https con {url} o parámetros clave=valor`,
      );
  }

  const client = pick(
    'NAPA_ADSENSE_CLIENT',
    /^ca-pub-\d{10,20}$/,
    'formato ca-pub-0000000000000000',
  );
  const slot = (k) => pick(k, /^\d{6,12}$/, 'el ID de bloque es numérico');
  return {
    siteUrl,
    apiUrl: pick('NAPA_API_URL', /^https:\/\/[^\s/]+$/, 'https://host sin barra final'),
    affiliates,
    adsense: client
      ? {
          client,
          slots: {
            feed: slot('NAPA_ADSENSE_SLOT_FEED'),
            product: slot('NAPA_ADSENSE_SLOT_PRODUCT'),
          },
        }
      : null,
    analytics: {
      goatcounter: pick(
        'NAPA_GOATCOUNTER',
        /^[a-z0-9-]{2,40}$/,
        'solo el código (p. ej. "napa" de napa.goatcounter.com)',
      ),
      cloudflareToken: pick(
        'NAPA_CF_BEACON_TOKEN',
        /^[a-f0-9]{32}$/,
        'token hexadecimal de 32 caracteres',
      ),
    },
    contactEmail: pick('NAPA_CONTACT_EMAIL', /^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'correo inválido'),
    legalOwner: pick('NAPA_LEGAL_OWNER'),
    channels: {
      telegram: pick(
        'NAPA_TELEGRAM_URL',
        /^https:\/\/t\.me\/[\w+]+$/,
        'formato https://t.me/canal',
      ),
      whatsapp: pick(
        'NAPA_WHATSAPP_URL',
        /^https:\/\/(www\.)?whatsapp\.com\/channel\/\w+$/,
        'formato https://whatsapp.com/channel/...',
      ),
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const config = buildSiteConfig();
  writeFileSync(
    new URL('../src/site-config.json', import.meta.url),
    JSON.stringify(config, null, 2) + '\n',
  );
  console.log(
    `[site-config] ${config.siteUrl} · afiliados: ${Object.keys(config.affiliates).join(', ') || 'ninguno'} · anuncios: ${config.adsense ? 'sí' : 'no'} · analítica: ${config.analytics.goatcounter || config.analytics.cloudflareToken ? 'sí' : 'no'}`,
  );
}

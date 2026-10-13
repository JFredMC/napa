import { telegramAlertUrl } from './site-config';

const decode = (url: string) => {
  const p = new URL(url).searchParams.get('start')!;
  expect(p.length).toBeLessThanOrEqual(64);
  const b = atob(p.slice(2).replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(b, (c) => c.charCodeAt(0)));
};

describe('telegramAlertUrl', () => {
  it('arma el deep link con la búsqueda en base64url (con tildes)', () => {
    const url = telegramAlertUrl('https://t.me/NapaOfertasBot', 'Café Sello Rojo 500 g');
    expect(url.startsWith('https://t.me/NapaOfertasBot?start=q_')).toBe(true);
    expect(decode(url)).toBe('Café Sello Rojo 500 g');
  });
  it('recorta búsquedas largas al límite de Telegram', () => {
    const url = telegramAlertUrl('https://t.me/B', 'ñ'.repeat(80));
    expect(decode(url).length).toBeGreaterThan(10);
  });
});

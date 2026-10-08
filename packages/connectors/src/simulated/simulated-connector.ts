import { matchesQuery, type Offer } from '@napa/deals-engine';
import type { SearchQuery, StoreConnector } from '../connector';
import { simulateStore, todayInBogota, type StoreProfile } from './generator';

/**
 * Adaptador SIMULADO. Devuelve ofertas ficticias (`source: 'simulated'`) generadas en el
 * código; no consulta la tienda real ni hace scraping.
 */
export function createSimulatedConnector(
  storeId: string,
  profile: StoreProfile,
  clock: () => string = () => todayInBogota(),
): StoreConnector {
  let cache: { day: string; offers: Offer[] } | null = null;
  const offers = () => {
    const day = clock();
    if (cache?.day !== day) cache = { day, offers: simulateStore(storeId, profile, day) };
    return cache.offers;
  };
  return {
    storeId,
    kind: 'simulated',
    async search(query: SearchQuery) {
      const found = offers().filter(
        (o) =>
          (!query.category || o.category === query.category) &&
          matchesQuery(`${o.title} ${o.brand} ${o.category}`, query.q),
      );
      return query.limit ? found.slice(0, query.limit) : found;
    },
  };
}

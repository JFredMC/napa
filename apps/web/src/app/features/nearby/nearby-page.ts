import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { STORES } from '@napa/connectors';
import { CatalogStore } from '../../core/catalog.store';
import { km } from '../../core/format';
import { LocationStore } from '../../core/location.store';
import { StoreChip } from '../../shared/ui';
import { MapView } from './map-view';

@Component({
  selector: 'app-nearby-page',
  imports: [RouterLink, MapView, StoreChip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './nearby-page.html',
})
export class NearbyPage {
  protected readonly loc = inject(LocationStore);
  protected readonly catalog = inject(CatalogStore);
  protected readonly stores = STORES;
  protected readonly km = km;
  protected readonly radii = [500, 1000, 1500, 3000];
  protected readonly selected = signal<string | null>(null);
  protected readonly showAll = signal(false);

  protected readonly list = computed(() => {
    const all = this.loc.places();
    return this.showAll() ? all : all.filter((p) => p.storeId);
  });

  /** Mejores ofertas de cada cadena cercana (precio con descuento real y puntaje). */
  protected readonly chains = computed(() =>
    this.loc.nearbyStoreIds().map((id) => {
      const offers = this.catalog.scored().filter((s) => s.offer.storeId === id);
      const honest = offers.filter(
        (s) => s.analysis.verdict === 'real' || s.analysis.verdict === 'minimo',
      );
      const best = [...honest].sort((a, b) => b.deal.score - a.deal.score).slice(0, 3);
      const places = this.loc.matched().filter((p) => p.storeId === id);
      return {
        id,
        count: offers.length,
        deals: honest.length,
        best,
        nearest: places[0]?.distanceKm ?? 0,
        sedes: places.length,
      };
    }),
  );
}

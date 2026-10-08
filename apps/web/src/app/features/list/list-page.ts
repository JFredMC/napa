import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CATEGORY_LABEL, STORES, STORE_IDS } from '@napa/connectors';
import { bestPerProduct, filterOffers, optimizeBasket, sortOffers } from '@napa/deals-engine';
import { CatalogStore } from '../../core/catalog.store';
import { cop } from '../../core/format';
import { ListsStore } from '../../core/lists.store';
import { LocationStore } from '../../core/location.store';
import { Toast } from '../../shared/toast';
import { SourceTag, StoreChip, Thumb } from '../../shared/ui';

/** Mercado de ejemplo para probar la división entre tiendas. */
const SAMPLE = [
  'arroz-5kg',
  'aceite-3l',
  'leche-6x1100',
  'huevos-30',
  'cafe-500',
  'atun-3x160',
  'queso-500',
  'papel-12',
  'detergente-3l',
  'panales-50',
  'cerveza-6x330',
];

@Component({
  selector: 'app-list-page',
  imports: [RouterLink, StoreChip, SourceTag, Thumb],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './list-page.html',
})
export class ListPage {
  protected readonly catalog = inject(CatalogStore);
  protected readonly lists = inject(ListsStore);
  protected readonly location = inject(LocationStore);
  private readonly toast = inject(Toast);
  protected readonly stores = STORES;
  protected readonly storeIds = STORE_IDS;
  protected readonly categoryLabel = CATEGORY_LABEL;
  protected readonly cop = cop;

  protected readonly maxStores = signal(2);
  protected readonly excluded = signal<string[]>([]);
  protected readonly nearbyOnly = signal(false);
  protected readonly query = signal('');

  protected readonly suggestions = computed(() => {
    const q = this.query().trim();
    if (q.length < 2) return [];
    const inList = new Set(this.lists.list().map((l) => l.productKey));
    return sortOffers(bestPerProduct(filterOffers(this.catalog.scored(), { query: q })), 'price')
      .filter((s) => !inList.has(s.offer.productKey))
      .slice(0, 6);
  });

  protected readonly allowed = computed(() => {
    const ex = new Set(this.excluded());
    const near = this.nearbyOnly() ? new Set(this.location.nearbyStoreIds()) : null;
    return STORE_IDS.filter((id) => !ex.has(id) && (!near || near.has(id)));
  });

  protected readonly result = computed(() =>
    optimizeBasket(
      this.lists.list().map((l) => ({ productKey: l.productKey, qty: l.qty })),
      this.catalog.offers(),
      STORES,
      { maxStores: this.maxStores(), allowed: this.allowed() },
    ),
  );

  protected readonly titles = computed(
    () => new Map(this.lists.list().map((l) => [l.productKey, l.title])),
  );

  /** Precio más bajo de cada línea (en las tiendas permitidas), para la lista. */
  protected readonly cheapest = computed(() => {
    const allowed = new Set(this.allowed());
    const map = new Map<string, number>();
    for (const o of this.catalog.offers()) {
      if (!allowed.has(o.storeId)) continue;
      const cur = map.get(o.productKey);
      if (cur === undefined || o.price < cur) map.set(o.productKey, o.price);
    }
    return map;
  });

  protected freeShippingGap(storeId: string, subtotal: number): number {
    const free = STORES[storeId]?.shipping.freeFrom;
    return free && subtotal < free ? free - subtotal : 0;
  }

  protected add(key: string): void {
    const s = this.catalog.product(key)[0];
    if (!s) return;
    this.lists.addToList(s.offer);
    this.query.set('');
    this.toast.show(`“${s.offer.title}” va a tu lista`);
  }

  protected addSample(): void {
    for (const key of SAMPLE) {
      const s = this.catalog.product(key)[0];
      if (s) this.lists.addToList(s.offer, key === 'huevos-30' || key === 'leche-6x1100' ? 2 : 1);
    }
    this.toast.show('Mercado de ejemplo agregado');
  }

  protected toggleStore(id: string): void {
    this.excluded.update((ex) => (ex.includes(id) ? ex.filter((x) => x !== id) : [...ex, id]));
  }
}

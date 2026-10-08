import { Injectable, computed, effect, signal } from '@angular/core';
import type { CategoryId, Watch } from '@napa/deals-engine';
import { readJson, writeJson } from './storage';

/** Datos mínimos para mostrar un producto aunque sus ofertas aún no estén cargadas. */
export interface ProductSnapshot {
  productKey: string;
  title: string;
  brand: string;
  category: CategoryId;
}

export interface ListLine extends ProductSnapshot {
  qty: number;
}

export interface WatchItem extends Watch, ProductSnapshot {}

const KEYS = { favorites: 'napa:favorites', watches: 'napa:watches', list: 'napa:list' } as const;

/** Favoritos, alertas de precio y lista de compras, guardados en este navegador. */
@Injectable({ providedIn: 'root' })
export class ListsStore {
  readonly favorites = signal<ProductSnapshot[]>(readJson(KEYS.favorites, []));
  readonly watches = signal<WatchItem[]>(readJson(KEYS.watches, []));
  readonly list = signal<ListLine[]>(readJson(KEYS.list, []));

  readonly favoriteKeys = computed(() => new Set(this.favorites().map((f) => f.productKey)));
  readonly watchKeys = computed(() => new Set(this.watches().map((w) => w.productKey)));
  readonly listCount = computed(() => this.list().reduce((s, l) => s + l.qty, 0));

  constructor() {
    effect(() => writeJson(KEYS.favorites, this.favorites()));
    effect(() => writeJson(KEYS.watches, this.watches()));
    effect(() => writeJson(KEYS.list, this.list()));
  }

  toggleFavorite(p: ProductSnapshot): boolean {
    const on = !this.favoriteKeys().has(p.productKey);
    this.favorites.update((list) =>
      on ? [snapshot(p), ...list] : list.filter((f) => f.productKey !== p.productKey),
    );
    return on;
  }

  setWatch(p: ProductSnapshot, target: number, currentBest: number): void {
    const item: WatchItem = {
      ...snapshot(p),
      target: Math.round(target),
      priceAtCreation: currentBest,
      createdAt: new Date().toISOString(),
    };
    this.watches.update((list) => [item, ...list.filter((w) => w.productKey !== p.productKey)]);
  }

  removeWatch(productKey: string): void {
    this.watches.update((list) => list.filter((w) => w.productKey !== productKey));
  }

  addToList(p: ProductSnapshot, qty = 1): void {
    this.list.update((list) => {
      const found = list.find((l) => l.productKey === p.productKey);
      return found
        ? list.map((l) =>
            l.productKey === p.productKey ? { ...l, qty: Math.min(99, l.qty + qty) } : l,
          )
        : [...list, { ...snapshot(p), qty }];
    });
  }

  setQty(productKey: string, qty: number): void {
    this.list.update((list) =>
      qty <= 0
        ? list.filter((l) => l.productKey !== productKey)
        : list.map((l) => (l.productKey === productKey ? { ...l, qty: Math.min(99, qty) } : l)),
    );
  }

  clearList(): void {
    this.list.set([]);
  }
}

function snapshot(p: ProductSnapshot): ProductSnapshot {
  return { productKey: p.productKey, title: p.title, brand: p.brand, category: p.category };
}

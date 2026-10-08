import { TestBed } from '@angular/core/testing';
import { ListsStore } from './lists.store';

const RICE = {
  productKey: 'arroz-5kg',
  title: 'Arroz blanco 5 kg',
  brand: 'La Cosecha',
  category: 'despensa' as const,
};

describe('ListsStore', () => {
  let store: ListsStore;
  beforeEach(() => {
    localStorage.clear();
    store = TestBed.inject(ListsStore);
  });

  it('favoritos: alterna y guarda en localStorage', () => {
    expect(store.toggleFavorite(RICE)).toBe(true);
    TestBed.tick();
    expect(JSON.parse(localStorage.getItem('napa:favorites') ?? '[]')).toHaveLength(1);
    expect(store.toggleFavorite(RICE)).toBe(false);
    expect(store.favorites()).toHaveLength(0);
  });

  it('lista: suma cantidades, tope de 99 y quita en cero', () => {
    store.addToList(RICE, 2);
    store.addToList(RICE, 3);
    expect(store.listCount()).toBe(5);
    store.setQty(RICE.productKey, 500);
    expect(store.list()[0]?.qty).toBe(99);
    store.setQty(RICE.productKey, 0);
    expect(store.list()).toHaveLength(0);
  });

  it('alertas: una por producto, la última reemplaza', () => {
    store.setWatch(RICE, 18000.4, 19900);
    store.setWatch(RICE, 17500, 19900);
    expect(store.watches()).toHaveLength(1);
    expect(store.watches()[0]).toMatchObject({ target: 17500, priceAtCreation: 19900 });
    store.removeWatch(RICE.productKey);
    expect(store.watchKeys().size).toBe(0);
  });
});

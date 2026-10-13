import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CATEGORY_IDS, CATEGORY_LABEL, STORES, STORE_IDS } from '@napa/connectors';
import {
  bestPerProduct,
  filterOffers,
  sortOffers,
  topByCategory,
  type CategoryId,
  type SortKey,
} from '@napa/deals-engine';
import { CatalogStore } from '../../core/catalog.store';
import { CATEGORY_ICON, cop, pct } from '../../core/format';
import { LocationStore } from '../../core/location.store';
import { Seo } from '../../core/seo';
import { AdSlot } from '../../shared/ad-slot';
import { OfferCard } from '../../shared/offer-card';
import { StoreLink } from '../../shared/store-link';

const SORTS: { id: SortKey; label: string }[] = [
  { id: 'score', label: 'Mejor puntaje' },
  { id: 'price', label: 'Menor precio (con envío)' },
  { id: 'discount', label: 'Mayor descuento real' },
  { id: 'savings', label: 'Mayor ahorro' },
  { id: 'unit', label: 'Menor precio por unidad' },
];

const PAGE = 24;

function asCategory(c: string | null): CategoryId | null {
  return c && (CATEGORY_IDS as string[]).includes(c) ? (c as CategoryId) : null;
}

@Component({
  selector: 'app-deals-page',
  imports: [OfferCard, RouterLink, AdSlot, StoreLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './deals-page.html',
})
export class DealsPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly seo = inject(Seo);
  protected readonly catalog = inject(CatalogStore);
  protected readonly location = inject(LocationStore);
  protected readonly cop = cop;
  protected readonly pct = pct;
  protected readonly categories = CATEGORY_IDS;
  protected readonly categoryLabel = CATEGORY_LABEL;
  protected readonly categoryIcon = CATEGORY_ICON;
  protected readonly storeIds = STORE_IDS;
  protected readonly stores = STORES;
  protected readonly sorts = SORTS;
  protected readonly shown = signal(PAGE);
  protected readonly showFilters = signal(false);

  private readonly params = toSignal(this.route.queryParamMap, { requireSync: true });
  private readonly pathParams = toSignal(this.route.paramMap, { requireSync: true });
  protected readonly q = computed(() => this.params().get('q') ?? '');
  /** /categoria/:cat (página indexable); `?cat=` se mantiene por enlaces viejos. */
  protected readonly routeCat = computed(() => asCategory(this.pathParams().get('cat')));
  protected readonly cat = computed(() => this.routeCat() ?? asCategory(this.params().get('cat')));
  protected readonly selectedStores = computed(() =>
    (this.params().get('tiendas') ?? '').split(',').filter((s) => STORE_IDS.includes(s)),
  );
  protected readonly minDiscount = computed(() =>
    Math.min(90, Math.max(0, Number(this.params().get('min')) || 0)),
  );
  protected readonly onlyHonest = computed(() => this.params().get('honestos') === '1');
  protected readonly grouped = computed(() => this.params().get('todas') !== '1');
  protected readonly sort = computed<SortKey>(() => {
    const s = this.params().get('orden');
    return SORTS.some((x) => x.id === s) ? (s as SortKey) : 'score';
  });
  protected readonly filtering = computed(
    () =>
      !!(
        this.q() ||
        this.cat() ||
        this.selectedStores().length ||
        this.minDiscount() ||
        this.onlyHonest() ||
        this.params().get('orden')
      ),
  );

  protected readonly results = computed(() => {
    const filtered = filterOffers(this.catalog.scored(), {
      query: this.q(),
      ...(this.cat() ? { categories: [this.cat() as CategoryId] } : {}),
      stores: this.selectedStores(),
      minDiscount: this.minDiscount(),
      onlyHonest: this.onlyHonest(),
    });
    return sortOffers(this.grouped() ? bestPerProduct(filtered) : filtered, this.sort());
  });
  protected readonly visible = computed(() => this.results().slice(0, this.shown()));

  /** Inicio: lo mejor del día (sin descuentos inflados ni dudosos) y lo mejor por categoría. */
  protected readonly honest = computed(() =>
    filterOffers(this.catalog.scored(), { onlyHonest: true }),
  );
  protected readonly top = computed(() => sortOffers(bestPerProduct(this.honest())).slice(0, 8));
  protected readonly byCategory = computed(() => topByCategory(this.honest(), 4));
  protected readonly stats = computed(() => {
    const all = this.catalog.scored();
    const discounted = all.filter((s) => s.analysis.declaredPct > 0);
    const inflated = all.filter((s) => s.analysis.verdict === 'inflado');
    const real = all.filter(
      (s) => s.analysis.verdict === 'real' || s.analysis.verdict === 'minimo',
    );
    const avgReal = real.length
      ? real.reduce((t, s) => t + (s.analysis.realPct ?? 0), 0) / real.length
      : 0;
    return {
      offers: all.length,
      products: new Set(all.map((s) => s.offer.productKey)).size,
      stores: new Set(all.map((s) => s.offer.storeId)).size,
      discounted: discounted.length,
      inflated: inflated.length,
      inflatedShare: discounted.length ? (inflated.length / discounted.length) * 100 : 0,
      avgReal,
    };
  });

  constructor() {
    effect(() => this.updateSeo());
    // Modo API: cada búsqueda va al backend (con caché allá).
    effect(() => {
      if (this.catalog.connection() === 'ready')
        void this.catalog.search(this.q(), this.cat() ?? undefined);
    });
    effect(() => {
      this.results();
      this.shown.set(PAGE);
    });
  }

  private updateSeo(): void {
    const cat = this.routeCat();
    const label = cat ? CATEGORY_LABEL[cat] : null;
    const live = this.results()
      .filter((s) => s.offer.source === 'live')
      .slice(0, 20);
    const filtered = !!(this.q() || this.params().keys.some((k) => k !== 'cat'));
    const items = cat ? live : this.top().filter((s) => s.offer.source === 'live');
    const cheapest = live.length ? Math.min(...live.map((s) => s.offer.price)) : null;
    this.seo.set({
      title: label
        ? `Ofertas de ${label} en Colombia hoy · Ñapa`
        : 'Ñapa · Ofertas reales en Colombia',
      description: label
        ? `Compara precios de ${label.toLowerCase()} en supermercados y tiendas de Colombia` +
          (cheapest !== null ? ` desde ${cop(cheapest)}` : '') +
          '. Ñapa detecta descuentos inflados con el historial de precios.'
        : 'Compara precios de supermercados y tiendas de Colombia, detecta descuentos inflados con el historial de precios y encuentra dónde sale más barato, con envío incluido.',
      path: cat ? `categoria/${cat}` : '',
      // Búsquedas y filtros: no se indexan (la página canónica es la de inicio o la categoría).
      noindex: filtered || (!!cat && !live.length && this.catalog.mode() === 'snapshot'),
      jsonLd: [
        ...(cat ? [] : [this.seo.website()]),
        ...(items.length
          ? [
              this.seo.itemList(
                label ? `Ofertas de ${label}` : 'Top de ofertas de hoy',
                items.map((s) => s.offer),
              ),
            ]
          : []),
      ],
    });
  }

  protected update(patch: Record<string, string | null>): void {
    void this.router.navigate([], {
      queryParams: patch,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected onSearch(event: Event, value: string): void {
    event.preventDefault();
    this.update({ q: value.trim() || null });
  }

  protected toggleStore(id: string): void {
    const set = new Set(this.selectedStores());
    if (set.has(id)) set.delete(id);
    else set.add(id);
    this.update({ tiendas: set.size ? [...set].join(',') : null });
  }

  protected onlyNearby(): void {
    const ids = this.location.nearbyStoreIds();
    this.update({ tiendas: ids.length ? ids.join(',') : null });
  }

  protected clear(): void {
    void this.router.navigate([], { queryParams: {}, replaceUrl: true });
  }

  protected more(): void {
    this.shown.update((n) => n + PAGE);
  }
}

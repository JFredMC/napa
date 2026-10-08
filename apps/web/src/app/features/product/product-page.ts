import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CATEGORY_LABEL, STORES } from '@napa/connectors';
import {
  compareAcrossStores,
  savings,
  type ScoredOffer,
  shippingFor,
  shippingLabel,
  suggestTarget,
  unitPrice,
} from '@napa/deals-engine';
import { CatalogStore } from '../../core/catalog.store';
import { cop, pct, shortDate, unitLabel } from '../../core/format';
import { ListsStore } from '../../core/lists.store';
import { PriceChart } from '../../shared/price-chart';
import { StoreLink } from '../../shared/store-link';
import { AdSlot } from '../../shared/ad-slot';
import { Toast } from '../../shared/toast';
import { ScoreRing, SourceTag, StoreChip, Thumb, Verdict } from '../../shared/ui';

@Component({
  selector: 'app-product-page',
  imports: [
    RouterLink,
    PriceChart,
    StoreChip,
    SourceTag,
    ScoreRing,
    Verdict,
    Thumb,
    StoreLink,
    AdSlot,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-page.html',
})
export class ProductPage {
  /** Ruta /producto/:key y ?tienda= (enlazado por withComponentInputBinding). */
  readonly key = input.required<string>();
  readonly tienda = input<string | undefined>(undefined);

  protected readonly catalog = inject(CatalogStore);
  protected readonly lists = inject(ListsStore);
  private readonly toast = inject(Toast);
  private readonly router = inject(Router);
  protected readonly stores = STORES;
  protected readonly cop = cop;
  protected readonly pct = pct;
  protected readonly shortDate = shortDate;
  protected readonly Math = Math;
  protected readonly qty = signal(1);
  protected readonly targetDraft = signal<number | null>(null);

  protected readonly rows = computed(() => compareAcrossStores(this.catalog.scored(), this.key()));
  protected readonly cheapest = computed<ScoredOffer | null>(() => this.rows().at(0)?.item ?? null);
  /** Término para buscar el producto en otras tiendas: el título real sin tamaños sueltos. */
  protected readonly searchTerm = computed(() => {
    const title = this.cheapest()?.offer.title ?? '';
    return (
      title
        .replace(/\b(x\s*)?\d+([.,]\d+)?\s*(kg|g|gr|ml|l|lt|und|un)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim() || title
    );
  });
  protected readonly selected = computed<ScoredOffer | null>(() => {
    const id = this.tienda();
    return this.rows().find((r) => r.item.offer.storeId === id)?.item ?? this.cheapest();
  });
  protected readonly product = computed(() => this.cheapest()?.offer ?? null);
  protected readonly category = computed(() =>
    this.product() ? CATEGORY_LABEL[this.product()!.category] : '',
  );
  protected readonly spread = computed(() => {
    const r = this.rows();
    return r.length > 1 ? r[r.length - 1]!.item.landed - r[0]!.item.landed : 0;
  });
  protected readonly hasSimulated = computed(() =>
    this.rows().some((r) => r.item.offer.source === 'simulated'),
  );
  protected readonly fav = computed(() => this.lists.favoriteKeys().has(this.key()));
  protected readonly watch = computed(
    () => this.lists.watches().find((w) => w.productKey === this.key()) ?? null,
  );
  protected readonly bestPrice = computed(() =>
    Math.min(...this.rows().map((r) => r.item.offer.price)),
  );
  protected readonly suggested = computed(() => {
    const s = this.selected();
    return s ? suggestTarget(this.bestPrice(), s.analysis.stats?.min90) : 0;
  });
  protected readonly target = computed(
    () => this.targetDraft() ?? this.watch()?.target ?? this.suggested(),
  );

  protected unit(price: number, size: Parameters<typeof unitPrice>[1]): string {
    return unitLabel(unitPrice(price, size));
  }
  protected save(price: number, list: number): number {
    return savings(price, list);
  }
  protected ship(storeId: string, price: number): { cost: number; days: string } {
    const s = STORES[storeId];
    return s
      ? { cost: shippingFor(s.shipping, price), days: shippingLabel(s.shipping) }
      : { cost: 0, days: '' };
  }

  protected select(storeId: string): void {
    void this.router.navigate([], { queryParams: { tienda: storeId }, replaceUrl: true });
  }

  protected toggleFav(): void {
    const p = this.product();
    if (!p) return;
    this.toast.show(this.lists.toggleFavorite(p) ? 'Agregado a favoritos' : 'Quitado de favoritos');
  }

  protected addToList(): void {
    const p = this.product();
    if (!p) return;
    this.lists.addToList(p, this.qty());
    this.toast.show(`${this.qty()} × “${p.title}” en tu lista`);
  }

  protected setTarget(value: string): void {
    const n = Number(value.replace(/\D/g, ''));
    this.targetDraft.set(Number.isFinite(n) && n > 0 ? n : null);
  }

  protected saveWatch(): void {
    const p = this.product();
    if (!p || !(this.target() > 0)) return;
    this.lists.setWatch(p, this.target(), this.bestPrice());
    this.targetDraft.set(null);
    this.toast.show(`Te avisamos cuando baje a ${cop(this.target())}`);
  }

  protected removeWatch(): void {
    this.lists.removeWatch(this.key());
    this.toast.show('Alerta eliminada');
  }
}

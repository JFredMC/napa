import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CATEGORY_LABEL, STORES } from '@napa/connectors';
import {
  savings,
  shippingFor,
  shippingLabel,
  unitPrice,
  type ScoredOffer,
} from '@napa/deals-engine';
import { cop, pct, unitLabel } from '../core/format';
import { ListsStore } from '../core/lists.store';
import { Toast } from './toast';
import { ScoreRing, SourceTag, StoreChip, Thumb, Verdict } from './ui';

@Component({
  selector: 'app-offer-card',
  imports: [RouterLink, StoreChip, SourceTag, ScoreRing, Verdict, Thumb],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './offer-card.html',
})
export class OfferCard {
  readonly item = input.required<ScoredOffer>();
  /** Muestra la tienda más barata alternativa si existe. */
  readonly rank = input<number | null>(null);

  private readonly lists = inject(ListsStore);
  private readonly toast = inject(Toast);
  protected readonly cop = cop;
  protected readonly pct = pct;

  protected readonly o = computed(() => this.item().offer);
  protected readonly store = computed(() => STORES[this.o().storeId]);
  protected readonly category = computed(() => CATEGORY_LABEL[this.o().category]);
  protected readonly save = computed(() => savings(this.o().price, this.o().listPrice));
  protected readonly unit = computed(() => unitLabel(unitPrice(this.o().price, this.o().size)));
  protected readonly ship = computed(() => {
    const s = this.store();
    if (!s) return null;
    const cost = shippingFor(s.shipping, this.o().price);
    return { cost, days: shippingLabel(s.shipping), freeFrom: s.shipping.freeFrom };
  });
  protected readonly cheaperElsewhere = computed(() => {
    const peer = this.item().bestPeer;
    return peer !== null && peer < this.item().landed ? this.item().landed - peer : 0;
  });
  protected readonly fav = computed(() => this.lists.favoriteKeys().has(this.o().productKey));

  protected toggleFav(): void {
    const on = this.lists.toggleFavorite(this.o());
    this.toast.show(on ? 'Agregado a favoritos' : 'Quitado de favoritos');
  }

  protected addToList(): void {
    this.lists.addToList(this.o());
    this.toast.show(`“${this.o().title}” va a tu lista`);
  }
}

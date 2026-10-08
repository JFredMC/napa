import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { STORES } from '@napa/connectors';
import {
  VERDICT_LABEL,
  type CategoryId,
  type DiscountVerdict,
  type Grade,
  type Source,
} from '@napa/deals-engine';
import { CATEGORY_ICON } from '../core/format';

@Component({
  selector: 'app-store-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="store-chip" [style.--store]="color()"
    ><i aria-hidden="true"></i>{{ name() }}</span
  >`,
})
export class StoreChip {
  readonly storeId = input.required<string>();
  protected readonly name = computed(() => STORES[this.storeId()]?.name ?? this.storeId());
  protected readonly color = computed(() => STORES[this.storeId()]?.color ?? '#888');
}

/** Distintivo obligatorio junto a cada precio: simulado o en vivo. */
@Component({
  selector: 'app-source-tag',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (source() === 'live') {
      <span class="source-tag live" title="Precio real leído de la tienda" data-testid="tag-live"
        ><i class="bi bi-broadcast" aria-hidden="true"></i>En vivo</span
      >
    } @else {
      <span
        class="source-tag sim"
        title="Precio simulado: datos ficticios, no es un precio real"
        data-testid="tag-sim"
        ><i class="bi bi-cpu" aria-hidden="true"></i>Simulado</span
      >
    }`,
})
export class SourceTag {
  readonly source = input.required<Source>();
}

@Component({
  selector: 'app-score-ring',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span
    class="score-ring"
    [attr.data-grade]="grade()"
    [style.--p]="score()"
    [attr.aria-label]="'Puntaje ' + score() + ' de 100'"
    role="img"
    ><b>{{ score() }}</b></span
  >`,
})
export class ScoreRing {
  readonly score = input.required<number>();
  readonly grade = input.required<Grade>();
}

const VERDICT_ICON: Record<DiscountVerdict, string> = {
  real: 'bi-patch-check',
  minimo: 'bi-trophy',
  inflado: 'bi-exclamation-octagon',
  dudoso: 'bi-patch-question',
  'sin-historial': 'bi-clock-history',
  'sin-descuento': 'bi-dash-circle',
};

@Component({
  selector: 'app-verdict',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span
    class="verdict"
    [attr.data-v]="verdict()"
    [attr.data-testid]="'verdict-' + verdict()"
    ><i class="bi" [class]="icon()" aria-hidden="true"></i>{{ label() }}</span
  >`,
})
export class Verdict {
  readonly verdict = input.required<DiscountVerdict>();
  protected readonly label = computed(() => VERDICT_LABEL[this.verdict()]);
  protected readonly icon = computed(() => VERDICT_ICON[this.verdict()]);
}

/** Imagen del producto si viene de una tienda real; si no, ícono de la categoría. */
@Component({
  selector: 'app-thumb',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (image()) {
      <img class="thumb" [src]="image()" alt="" loading="lazy" referrerpolicy="no-referrer" />
    } @else {
      <span class="thumb icon" [attr.data-cat]="category()"
        ><i class="bi" [class]="icon()" aria-hidden="true"></i
      ></span>
    }`,
})
export class Thumb {
  readonly category = input.required<CategoryId>();
  readonly image = input<string | undefined>(undefined);
  protected readonly icon = computed(() => CATEGORY_ICON[this.category()]);
}

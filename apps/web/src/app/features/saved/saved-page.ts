import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CATEGORY_LABEL } from '@napa/connectors';
import { checkWatches } from '@napa/deals-engine';
import { CatalogStore } from '../../core/catalog.store';
import { cop, shortDate } from '../../core/format';
import { ListsStore } from '../../core/lists.store';
import { Toast } from '../../shared/toast';
import { SourceTag, StoreChip, Thumb, Verdict } from '../../shared/ui';

@Component({
  selector: 'app-saved-page',
  imports: [RouterLink, StoreChip, SourceTag, Thumb, Verdict],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './saved-page.html',
})
export class SavedPage {
  readonly tab = input<string | undefined>(undefined);
  protected readonly catalog = inject(CatalogStore);
  protected readonly lists = inject(ListsStore);
  private readonly toast = inject(Toast);
  private readonly router = inject(Router);
  protected readonly cop = cop;
  protected readonly shortDate = shortDate;
  protected readonly categoryLabel = CATEGORY_LABEL;

  protected readonly current = computed(() => (this.tab() === 'alertas' ? 'alertas' : 'favoritos'));

  protected readonly favorites = computed(() =>
    this.lists
      .favorites()
      .map((f) => ({ snap: f, best: this.catalog.product(f.productKey)[0] ?? null })),
  );

  protected readonly watches = computed(() => {
    const status = checkWatches(this.lists.watches(), this.catalog.offers());
    return this.lists
      .watches()
      .map((w, i) => ({
        w,
        s: status[i]!,
        scored:
          this.catalog.product(w.productKey).find((x) => x.offer.id === status[i]?.best?.id) ??
          null,
      }))
      .sort((a, b) => Number(b.s.triggered) - Number(a.s.triggered));
  });

  protected go(tab: 'favoritos' | 'alertas'): void {
    void this.router.navigate([], {
      queryParams: { tab: tab === 'favoritos' ? null : tab },
      replaceUrl: true,
    });
  }

  protected unfav(key: string, title: string): void {
    this.lists.favorites.update((l) => l.filter((f) => f.productKey !== key));
    this.toast.show(`“${title}” quitado de favoritos`);
  }

  protected removeWatch(key: string): void {
    this.lists.removeWatch(key);
    this.toast.show('Alerta eliminada');
  }
}

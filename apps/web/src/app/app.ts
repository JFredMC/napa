import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { checkWatches } from '@napa/deals-engine';
import { CatalogStore } from './core/catalog.store';
import { ListsStore } from './core/lists.store';
import { API_URL, switchMode } from './core/mode';
import { ThemeStore } from './core/theme.store';
import { Toast } from './shared/toast';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
})
export class App {
  protected readonly theme = inject(ThemeStore);
  protected readonly catalog = inject(CatalogStore);
  protected readonly lists = inject(ListsStore);
  protected readonly toast = inject(Toast);
  protected readonly apiUrl = inject(API_URL);
  protected readonly year = new Date().getFullYear();
  protected readonly switchMode = switchMode;

  /** Alertas cumplidas (precio objetivo alcanzado). */
  protected readonly triggered = computed(
    () =>
      checkWatches(this.lists.watches(), this.catalog.offers()).filter((s) => s.triggered).length,
  );

  protected readonly nav = [
    { path: '/', label: 'Ofertas', icon: 'bi-fire', exact: true },
    { path: '/lista', label: 'Lista', icon: 'bi-cart3', exact: false },
    { path: '/guardados', label: 'Guardados', icon: 'bi-bookmark-heart', exact: false },
    { path: '/cerca', label: 'Cerca', icon: 'bi-geo-alt', exact: false },
    { path: '/fuentes', label: 'Fuentes', icon: 'bi-shield-check', exact: false },
  ];
}

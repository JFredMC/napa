import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { STORES, type StoreMeta } from '@napa/connectors';
import { INFLATION_TOLERANCE, MIN_HISTORY_DAYS, SUSPICIOUS_PCT } from '@napa/deals-engine';
import { CatalogStore, type SourceStatus } from '../../core/catalog.store';
import { API_URL } from '../../core/mode';
import { StoreChip } from '../../shared/ui';

const ADAPTER: Record<StoreMeta['liveSource'], string> = {
  vtex: 'Catálogo público VTEX',
  'mercadolibre-api': 'API oficial (OAuth)',
  none: 'Sin API pública',
};

@Component({
  selector: 'app-sources-page',
  imports: [StoreChip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sources-page.html',
})
export class SourcesPage {
  protected readonly catalog = inject(CatalogStore);
  protected readonly apiUrl = inject(API_URL);
  protected readonly adapter = ADAPTER;
  protected readonly minDays = MIN_HISTORY_DAYS;
  protected readonly tolerance = Math.round((INFLATION_TOLERANCE - 1) * 100);
  protected readonly suspicious = SUSPICIOUS_PCT;
  protected readonly live = signal<SourceStatus[] | null>(null);

  /** Qué podría ser real con el backend local (independiente del modo actual). */
  protected readonly potential: Record<string, string> = {
    jumbo: 'Real (backend)',
    olimpica: 'Real (backend)',
    exito: 'Bloqueada por robots.txt',
    carulla: 'Bloqueada por robots.txt',
    mercadolibre: 'Real con token OAuth',
  };

  protected readonly rows = computed(() => {
    const status = new Map((this.live() ?? this.catalog.statuses()).map((s) => [s.storeId, s]));
    return Object.values(STORES).map((s) => ({ store: s, status: status.get(s.id) ?? null }));
  });

  constructor() {
    if (this.catalog.mode === 'api' && this.apiUrl) {
      fetch(`${this.apiUrl}/api/sources`)
        .then((r) => (r.ok ? (r.json() as Promise<SourceStatus[]>) : null))
        .then((s) => s && this.live.set(s))
        .catch(() => undefined);
    }
  }
}

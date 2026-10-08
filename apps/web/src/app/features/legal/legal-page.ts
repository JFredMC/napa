import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AFFILIATE_PROGRAMS, STORES } from '@napa/connectors';
import { ConsentStore } from '../../core/consent.store';
import { SITE_CONFIG } from '../../core/site-config';

export type LegalDoc = 'privacidad' | 'terminos' | 'afiliados' | 'cookies';

/** Páginas legales en español: privacidad (Ley 1581), términos, afiliados y publicidad, cookies. */
@Component({
  selector: 'app-legal-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './legal-page.html',
})
export class LegalPage {
  /** Viene de `data.doc` en la ruta. */
  readonly doc = input.required<LegalDoc>();
  protected readonly config = inject(SITE_CONFIG);
  protected readonly consent = inject(ConsentStore);
  protected readonly updated = '8 de octubre de 2026';
  protected readonly owner = computed(() => this.config.legalOwner ?? 'JFredDev, creador de Ñapa');
  protected readonly email = computed(
    () => this.config.contactEmail ?? '[correo de contacto pendiente: lo publica el responsable]',
  );
  protected readonly programs = AFFILIATE_PROGRAMS.map((p) => ({
    ...p,
    store: STORES[p.storeId]?.name ?? p.storeId,
    active: !!this.config.affiliates[p.storeId],
  }));
  protected readonly activeAffiliates = Object.keys(this.config.affiliates)
    .map((id) => STORES[id]?.name ?? id)
    .join(', ');
  protected readonly links = [
    { doc: 'privacidad', label: 'Privacidad' },
    { doc: 'terminos', label: 'Términos' },
    { doc: 'afiliados', label: 'Afiliados y publicidad' },
    { doc: 'cookies', label: 'Cookies' },
  ] as const;
}

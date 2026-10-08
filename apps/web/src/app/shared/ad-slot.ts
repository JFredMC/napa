import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  effect,
} from '@angular/core';
import { ConsentStore } from '../core/consent.store';
import { SITE_CONFIG } from '../core/site-config';

/**
 * Espacio publicitario reservado. No ocupa nada hasta que haya ID de editor de AdSense, ID del
 * bloque y consentimiento para anuncios; entonces reserva su alto para no mover la página.
 */
@Component({
  selector: 'app-ad-slot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (active(); as a) {
      <aside class="ad-slot" aria-label="Publicidad" [attr.data-testid]="'ad-' + slot()">
        <span class="ad-label">Publicidad</span>
        <ins
          class="adsbygoogle"
          style="display:block"
          [attr.data-ad-client]="a.client"
          [attr.data-ad-slot]="a.slot"
          data-ad-format="auto"
          data-full-width-responsive="true"
        ></ins>
      </aside>
    }
  `,
})
export class AdSlot {
  readonly slot = input.required<'feed' | 'product'>();
  private readonly config = inject(SITE_CONFIG);
  private readonly consent = inject(ConsentStore);
  private readonly host = inject(ElementRef<HTMLElement>);
  private pushed = false;

  protected readonly active = computed(() => {
    const ads = this.config.adsense;
    const slot = ads?.slots[this.slot()];
    return ads && slot && this.consent.ads() ? { client: ads.client, slot } : null;
  });

  constructor() {
    effect(() => {
      if (!this.active() || this.pushed || typeof window === 'undefined') return;
      queueMicrotask(() => {
        if (!this.host.nativeElement.querySelector('ins.adsbygoogle')) return;
        this.pushed = true;
        (window.adsbygoogle = window.adsbygoogle ?? []).push({});
      });
    });
  }
}

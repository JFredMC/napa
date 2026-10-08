import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { Offer } from '@napa/deals-engine';
import { OUTBOUND_REL, Outbound } from '../core/outbound';

/**
 * Botón de salida a una tienda: pestaña nueva, rel="sponsored nofollow noopener" y aviso cuando
 * el enlace es de afiliado.
 */
@Component({
  selector: 'app-store-link',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (link(); as l) {
      <a
        [class]="
          iconOnly()
            ? 'btn icon ghost'
            : 'btn small ' + (variant() === 'primary' ? 'primary' : 'ghost')
        "
        [attr.aria-label]="
          iconOnly()
            ? (label() || l.label) +
              (l.affiliate ? ' (enlace de afiliado)' : '') +
              ', se abre en otra pestaña'
            : null
        "
        [attr.title]="iconOnly() ? label() || l.label : null"
        [href]="l.href"
        target="_blank"
        [attr.rel]="rel"
        (click)="outbound.track(l)"
        [attr.data-testid]="'out-' + l.storeId"
        [attr.data-affiliate]="l.affiliate ? '1' : '0'"
      >
        @if (!iconOnly()) {
          {{ label() || l.label }}
        }
        <i class="bi bi-box-arrow-up-right" aria-hidden="true"></i
      ></a>
      @if (l.affiliate && showNote() && !iconOnly()) {
        <small class="aff-note muted" data-testid="aff-note"
          >Enlace de afiliado: Ñapa puede recibir una comisión, sin costo extra para ti.</small
        >
      }
    }
  `,
})
export class StoreLink {
  readonly offer = input<Offer | null>(null);
  readonly storeId = input<string | null>(null);
  readonly query = input<string>('');
  readonly label = input<string>('');
  readonly variant = input<'primary' | 'ghost'>('ghost');
  readonly showNote = input(true);
  readonly iconOnly = input(false);

  protected readonly outbound = inject(Outbound);
  protected readonly rel = OUTBOUND_REL;
  protected readonly link = computed(() => {
    const o = this.offer();
    if (o) return this.outbound.forOffer(o);
    const id = this.storeId();
    return id ? this.outbound.search(id, this.query()) : null;
  });
}

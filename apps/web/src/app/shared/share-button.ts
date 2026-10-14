import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { cop } from '../core/format';
import { SITE_CONFIG } from '../core/site-config';

/** Texto corto para compartir una oferta (WhatsApp o la hoja nativa del celular). */
export function shareText(title: string, price: number, store: string | null, url: string): string {
  const where = store ? ` en ${store}` : '';
  return `Mira este precio en Ñapa: ${title} a ${cop(price)}${where}. Compara tiendas aquí: ${url}`;
}

export function whatsappUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/**
 * "Compartir por WhatsApp": enlace wa.me para todos; en celulares con Web Share API abre la hoja
 * nativa de compartir (WhatsApp, Telegram…). Sin JavaScript el enlace sigue funcionando.
 */
@Component({
  selector: 'app-share-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a
      [class]="iconOnly() ? 'btn icon ghost share' : 'btn ghost small share'"
      [href]="wa()"
      target="_blank"
      rel="noopener"
      (click)="share($event)"
      [attr.aria-label]="'Compartir por WhatsApp: ' + title()"
      [attr.title]="iconOnly() ? 'Compartir por WhatsApp' : null"
      data-testid="share"
    >
      <i class="bi bi-whatsapp" aria-hidden="true"></i>
      @if (!iconOnly()) {
        Compartir por WhatsApp
      }
    </a>
  `,
})
export class ShareButton {
  readonly title = input.required<string>();
  readonly price = input.required<number>();
  readonly store = input<string | null>(null);
  /** Ruta dentro del sitio, p. ej. "producto/jumbo-123" o "?q=arroz". */
  readonly path = input.required<string>();
  readonly iconOnly = input(false);

  private readonly site = inject(SITE_CONFIG);
  protected readonly url = computed(() => new URL(this.path(), this.site.siteUrl).href);
  protected readonly text = computed(() =>
    shareText(this.title(), this.price(), this.store(), this.url()),
  );
  protected readonly wa = computed(() => whatsappUrl(this.text()));

  protected async share(e: Event): Promise<void> {
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    const mobile = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
    if (!nav?.share || !mobile) return; // escritorio: sigue el enlace a wa.me
    e.preventDefault();
    try {
      await nav.share({
        title: this.title(),
        text: this.text().replace(` ${this.url()}`, ''),
        url: this.url(),
      });
    } catch (err) {
      // Cancelado por la persona: no se hace nada. Otro error: WhatsApp como respaldo.
      if ((err as Error)?.name !== 'AbortError') window.open(this.wa(), '_blank', 'noopener');
    }
  }
}

import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AFFILIATE_PROGRAMS, STORES } from '@napa/connectors';
import { ConsentStore } from '../../core/consent.store';
import { Seo } from '../../core/seo';
import { SITE_CONFIG } from '../../core/site-config';

export type LegalDoc = 'privacidad' | 'terminos' | 'afiliados' | 'cookies';

const SEO: Record<LegalDoc, { title: string; description: string }> = {
  privacidad: {
    title: 'Política de privacidad · Ñapa',
    description:
      'Cómo trata Ñapa los datos personales según la Ley 1581 de 2012: qué se guarda, para qué, tus derechos y cómo ejercerlos.',
  },
  terminos: {
    title: 'Términos de uso · Ñapa',
    description:
      'Condiciones de uso de Ñapa: precios en vivo y simulados, enlaces a tiendas y responsabilidades.',
  },
  afiliados: {
    title: 'Afiliados y publicidad · Ñapa',
    description:
      'Cómo se financia Ñapa: enlaces de afiliado y anuncios que no cambian el orden, el puntaje ni los veredictos.',
  },
  cookies: {
    title: 'Cookies · Ñapa',
    description:
      'Qué cookies y almacenamiento local usa Ñapa, cuáles requieren tu consentimiento y cómo cambiarlo.',
  },
};

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
  private readonly seo = inject(Seo);
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

  constructor() {
    effect(() => this.seo.set({ ...SEO[this.doc()], path: this.doc(), type: 'article' }));
  }
}

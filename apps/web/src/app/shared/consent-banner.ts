import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConsentStore } from '../core/consent.store';
import { SITE_CONFIG } from '../core/site-config';

/** Aviso de privacidad y cookies con autorización previa, expresa e informada (Ley 1581). */
@Component({
  selector: 'app-consent-banner',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (consent.showBanner()) {
      <section
        class="consent"
        role="dialog"
        aria-modal="false"
        aria-labelledby="consent-title"
        data-testid="consent-banner"
      >
        <h2 id="consent-title">Tu privacidad</h2>
        <p>
          Ñapa funciona sin registrarte. Con tu autorización usamos
          @if (hasAnalytics) {
            <strong>estadísticas sin cookies</strong> para saber qué páginas sirven
          }
          @if (hasAnalytics && hasAds) {
            y
          }
          @if (hasAds) {
            <strong>anuncios de Google</strong>, que usan cookies
          }
          . Puedes cambiar tu decisión cuando quieras en “Privacidad” al pie de la página. Más en la
          <a routerLink="/privacidad">política de privacidad</a> y en
          <a routerLink="/cookies">cookies</a>.
        </p>
        @if (showDetails()) {
          <div class="consent-options">
            <label
              ><input type="checkbox" checked disabled /> Necesarias (tus listas y ajustes en este
              navegador)</label
            >
            @if (hasAnalytics) {
              <label
                ><input
                  type="checkbox"
                  [checked]="analytics()"
                  (change)="analytics.set(!analytics())"
                  data-testid="consent-analytics"
                />
                Estadísticas sin cookies</label
              >
            }
            @if (hasAds) {
              <label
                ><input
                  type="checkbox"
                  [checked]="ads()"
                  (change)="ads.set(!ads())"
                  data-testid="consent-ads"
                />
                Anuncios de Google</label
              >
              <label [class.muted]="!ads()"
                ><input
                  type="checkbox"
                  [checked]="personalized()"
                  [disabled]="!ads()"
                  (change)="personalized.set(!personalized())"
                />
                Anuncios personalizados según tus intereses</label
              >
            }
          </div>
        }
        <div class="consent-actions">
          <button
            type="button"
            class="btn ghost small"
            (click)="consent.rejectAll()"
            data-testid="consent-reject"
          >
            Solo necesarias
          </button>
          @if (showDetails()) {
            <button
              type="button"
              class="btn ghost small"
              (click)="
                consent.save({
                  analytics: analytics(),
                  ads: ads(),
                  personalizedAds: personalized(),
                })
              "
              data-testid="consent-save"
            >
              Guardar mi elección
            </button>
          } @else {
            <button
              type="button"
              class="btn ghost small"
              (click)="details.set(true)"
              data-testid="consent-configure"
            >
              Configurar
            </button>
          }
          <button
            type="button"
            class="btn primary small"
            (click)="consent.acceptAll()"
            data-testid="consent-accept"
          >
            Aceptar todo
          </button>
        </div>
      </section>
    }
  `,
})
export class ConsentBanner {
  protected readonly consent = inject(ConsentStore);
  private readonly config = inject(SITE_CONFIG);
  protected readonly hasAnalytics = !!(
    this.config.analytics.goatcounter || this.config.analytics.cloudflareToken
  );
  protected readonly hasAds = !!this.config.adsense;
  protected readonly details = signal(false);
  protected readonly analytics = signal(this.consent.analytics());
  protected readonly ads = signal(this.consent.ads());
  protected readonly personalized = signal(this.consent.personalizedAds());
  protected readonly showDetails = computed(() => this.details() || this.consent.editing());

  constructor() {
    // Al reabrir las preferencias, partir de lo que ya se eligió.
    effect(() => {
      if (!this.consent.editing()) return;
      this.analytics.set(this.consent.analytics());
      this.ads.set(this.consent.ads());
      this.personalized.set(this.consent.personalizedAds());
    });
  }
}

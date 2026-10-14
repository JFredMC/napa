import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { STORES } from '@napa/connectors';
import { unitPrice, type Offer } from '@napa/deals-engine';
import { CatalogStore } from '../../core/catalog.store';
import { cop, shortDate, unitLabel } from '../../core/format';
import { Seo } from '../../core/seo';
import { SNAPSHOT_LOADER } from '../../core/snapshot';
import { STAPLES, stapleBySlug, stapleOffers } from '../../core/staples';

/** /precio/<slug>: precio de un básico hoy en Colombia (Jumbo y Olímpica en vivo). */
@Component({
  selector: 'app-price-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './price-page.html',
})
export class PricePage {
  private readonly route = inject(ActivatedRoute);
  private readonly catalog = inject(CatalogStore);
  private readonly seo = inject(Seo);
  private readonly loadSnapshot = inject(SNAPSHOT_LOADER);
  protected readonly cop = cop;
  protected readonly stores = STORES;
  protected readonly others = computed(() => STAPLES.filter((s) => s.slug !== this.staple()?.slug));

  private readonly params = toSignal(this.route.paramMap, { requireSync: true });
  protected readonly staple = computed(() => stapleBySlug(this.params().get('slug')));
  private readonly snapshot = signal<{ at: string | null; offers: Offer[] }>({
    at: null,
    offers: [],
  });

  /** Precios en vivo del backend (si responde) sobre la foto guardada en el build. */
  protected readonly offers = computed(() => {
    const s = this.staple();
    if (!s) return [];
    const merged = new Map(this.snapshot().offers.map((o) => [o.id, o]));
    for (const o of this.catalog.offers()) if (o.source === 'live') merged.set(o.id, o);
    return stapleOffers([...merged.values()], s).slice(0, 12);
  });
  protected readonly live = computed(
    () => this.catalog.mode() === 'api' && this.catalog.connection() === 'ready',
  );
  protected readonly asOf = computed(() =>
    this.live() ? 'ahora' : this.snapshot().at ? `el ${shortDate(this.snapshot().at!)}` : '',
  );
  protected readonly min = computed(() => this.offers()[0] ?? null);
  protected readonly max = computed(() => this.offers().at(-1) ?? null);
  protected readonly storeCount = computed(() => new Set(this.offers().map((o) => o.storeId)).size);
  protected unit(o: Offer): string {
    return unitLabel(unitPrice(o.price, o.size)) ?? '';
  }

  protected readonly faq = computed(() => {
    const s = this.staple();
    if (!s) return [];
    const m = this.min();
    const name = s.name;
    return [
      {
        q: `¿Cuánto cuesta ${name} hoy en Colombia?`,
        a: m
          ? `En la última consulta de Ñapa, la opción más barata de ${name} fue ${m.title} a ${cop(m.price)} en ${STORES[m.storeId]?.name ?? m.storeId}. El precio cambia según la marca, el tamaño y la tienda; compara por unidad (kilo, litro o unidad) antes de comprar.`
          : `Ñapa consulta precios reales de ${name} en Jumbo y Olímpica. Ahora mismo no hay precios guardados; vuelve a intentarlo en unos minutos.`,
      },
      {
        q: `¿Dónde está más barato ${name}?`,
        a: `Ñapa ordena las opciones de ${name} por precio en las tiendas con datos en vivo (hoy Jumbo y Olímpica). El precio por unidad te dice cuál rinde más; el más barato del paquete no siempre es el más económico.`,
      },
      {
        q: '¿De dónde salen estos precios?',
        a: 'De los catálogos públicos de las tiendas, consultados por el servidor de Ñapa respetando sus reglas (robots.txt) y con caché. No son precios de todas las sedes ni incluyen promociones en tienda física: confírmalos en la tienda antes de comprar.',
      },
      {
        q: '¿Ñapa vende productos?',
        a: 'No. Ñapa solo compara y recomienda; la compra se hace en la tienda. Algunos enlaces pueden ser de afiliado, sin costo extra para ti.',
      },
    ];
  });

  constructor() {
    void this.loadSnapshot().then((snap) =>
      this.snapshot.set({ at: snap.fetchedAt, offers: snap.offers }),
    );
    effect(() => {
      const s = this.staple();
      if (s && this.live()) void this.catalog.search(s.q);
    });
    effect(() => {
      const s = this.staple();
      const path = `precio/${s?.slug ?? this.params().get('slug') ?? ''}`;
      if (!s) {
        this.seo.set({
          title: 'Precio no encontrado · Ñapa',
          description: 'Página no encontrada.',
          path,
          noindex: true,
        });
        return;
      }
      const m = this.min();
      const offers = this.offers();
      this.seo.set({
        title: `Precio de ${s.name} hoy en Colombia | Ñapa`,
        description: m
          ? `Precio de ${s.name} hoy: desde ${cop(m.price)} en ${STORES[m.storeId]?.name}. Compara ${offers.length} opciones reales en Jumbo y Olímpica, con precio por unidad.`
          : `Compara el precio de ${s.name} hoy en Jumbo y Olímpica con precios reales y precio por unidad.`,
        path,
        image: m?.image ?? null,
        jsonLd: [
          {
            '@type': 'FAQPage',
            mainEntity: this.faq().map((f) => ({
              '@type': 'Question',
              name: f.q,
              acceptedAnswer: { '@type': 'Answer', text: f.a },
            })),
          },
          this.seo.itemList(`Precio de ${s.name} hoy`, offers),
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Ñapa', item: this.seo.url('') },
              {
                '@type': 'ListItem',
                position: 2,
                name: `Precio de ${s.name}`,
                item: this.seo.url(path),
              },
            ],
          },
        ],
      });
    });
  }
}

import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { CATEGORY_LABEL, STORES } from '@napa/connectors';
import type { Offer } from '@napa/deals-engine';
import { cop } from './format';
import { SITE_CONFIG } from './site-config';

export interface SeoData {
  title: string;
  description: string;
  /** Ruta relativa a la raíz del sitio, sin "/" inicial ('' = inicio). */
  path: string;
  image?: string | null;
  type?: 'website' | 'product' | 'article';
  noindex?: boolean;
  jsonLd?: object[];
}

const LD_ID = 'napa-ld';
const DEFAULT_IMAGE = 'og.jpg';

/**
 * Título, descripción, canónica, Open Graph/Twitter y JSON-LD por página. Al prerenderizar
 * queda en el HTML estático (buscadores y vistas previas de WhatsApp/Telegram/X); en el
 * navegador se actualiza al navegar.
 */
@Injectable({ providedIn: 'root' })
export class Seo {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly doc = inject(DOCUMENT);
  private readonly site = inject(SITE_CONFIG).siteUrl;

  url(path: string): string {
    return new URL(path, this.site).href;
  }

  set(d: SeoData): void {
    const url = this.url(d.path);
    const image = d.image ? d.image : this.url(DEFAULT_IMAGE);
    this.title.setTitle(d.title);
    const tags: [string, string, string][] = [
      ['name', 'description', d.description],
      ['name', 'robots', d.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large'],
      ['property', 'og:title', d.title],
      ['property', 'og:description', d.description],
      ['property', 'og:url', url],
      ['property', 'og:type', d.type ?? 'website'],
      ['property', 'og:image', image],
      ['property', 'og:site_name', 'Ñapa'],
      ['property', 'og:locale', 'es_CO'],
      ['name', 'twitter:card', d.image ? 'summary' : 'summary_large_image'],
      ['name', 'twitter:title', d.title],
      ['name', 'twitter:description', d.description],
      ['name', 'twitter:image', image],
    ];
    for (const [attr, key, content] of tags)
      this.meta.updateTag({ [attr]: key, content }, `${attr}="${key}"`);
    if (d.image) {
      this.meta.removeTag('property="og:image:width"');
      this.meta.removeTag('property="og:image:height"');
    } else {
      this.meta.updateTag({ property: 'og:image:width', content: '1200' });
      this.meta.updateTag({ property: 'og:image:height', content: '630' });
    }
    this.link('canonical', url);
    this.setJsonLd(d.jsonLd ?? []);
  }

  /** Sitio con buscador interno (cuadro de búsqueda en resultados de Google). */
  website(): object {
    return {
      '@type': 'WebSite',
      '@id': this.url('#sitio'),
      name: 'Ñapa',
      url: this.url(''),
      inLanguage: 'es-CO',
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: `${this.url('')}?q={search_term_string}` },
        'query-input': 'required name=search_term_string',
      },
    };
  }

  /** Lista de productos enlazados a su página en Ñapa. */
  itemList(name: string, offers: Offer[]): object {
    return {
      '@type': 'ItemList',
      name,
      itemListElement: offers.map((o, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: this.url(`producto/${encodeURIComponent(o.productKey)}`),
        name: o.title,
      })),
    };
  }

  /** Producto con los precios reales de cada tienda (solo ofertas `live`). */
  product(offers: Offer[]): object | null {
    // Sin precio válido no hay oferta que Google pueda mostrar: esa oferta no entra al LD.
    const live = offers.filter((o) => o.source === 'live' && o.price > 0);
    const first = live[0];
    if (!first) return null;
    const productUrl = this.url(`producto/${encodeURIComponent(first.productKey)}`);
    const prices = live.map((o) => o.price);
    const valid = new Date(
      Math.max(...live.map((o) => Date.parse(o.observedAt) || 0)) + 7 * 86_400_000,
    )
      .toISOString()
      .slice(0, 10);
    // Una fecha de validez ya vencida (foto vieja) invalida la oferta: mejor omitirla
    // que prometer un precio vigente que ya no lo es.
    const priceValidUntil = valid >= new Date().toISOString().slice(0, 10) ? valid : null;
    const images = [...new Set(live.map((o) => o.image).filter((i): i is string => !!i))];
    const storeNames = [...new Set(live.map((o) => STORES[o.storeId]?.name ?? o.storeId))];
    const each = live.map((o) => ({
      '@type': 'Offer',
      // Si la tienda no trae enlace propio, la oferta apunta a la ficha de Ñapa.
      url: o.url || productUrl,
      sku: o.id,
      price: o.price,
      priceCurrency: 'COP',
      // validFrom: momento real en que Ñapa leyó este precio en la tienda (observedAt).
      ...(validFrom(o.observedAt) ? { validFrom: validFrom(o.observedAt) } : {}),
      ...(priceValidUntil ? { priceValidUntil } : {}),
      // El stock manda: cantidad 0 conocida no es InStock aunque la oferta siga listada.
      availability: o.stock === 0 ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
      seller: { '@type': 'Organization', name: STORES[o.storeId]?.name ?? o.storeId },
    }));
    const category = CATEGORY_LABEL[first.category] ?? first.category;
    return {
      '@type': 'Product',
      '@id': productUrl,
      name: first.title,
      description:
        `${first.title}${first.brand ? ` (${first.brand})` : ''}: compara precios en ` +
        `${storeNames.join(' y ')} desde ${cop(Math.min(...prices))} COP en Ñapa, Colombia. ` +
        `Categoría: ${category}. Precio observado por Ñapa; la disponibilidad la confirma la tienda.`,
      ...(first.brand ? { brand: { '@type': 'Brand', name: first.brand } } : {}),
      ...(images.length ? { image: images } : {}),
      category,
      url: productUrl,
      offers:
        each.length === 1
          ? each[0]
          : {
              '@type': 'AggregateOffer',
              priceCurrency: 'COP',
              lowPrice: Math.min(...prices),
              highPrice: Math.max(...prices),
              offerCount: each.length,
              offers: each,
            },
    };
  }

  private link(rel: string, href: string): void {
    let el = this.doc.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
    if (!el) {
      el = this.doc.createElement('link');
      el.setAttribute('rel', rel);
      this.doc.head.appendChild(el);
    }
    el.setAttribute('href', href);
  }

  private setJsonLd(items: object[]): void {
    this.doc.getElementById(LD_ID)?.remove();
    if (!items.length) return;
    const el = this.doc.createElement('script');
    el.id = LD_ID;
    el.setAttribute('type', 'application/ld+json');
    // "<" escapado: un título con "</script>" no puede cerrar la etiqueta.
    el.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': items }).replace(
      /</g,
      '\\u003c',
    );
    this.doc.head.appendChild(el);
  }
}

/** ISO 8601 normalizado de una fecha real; null si no es válida (nunca se inventa). */
function validFrom(observedAt: string | undefined): string | null {
  const t = observedAt ? Date.parse(observedAt) : NaN;
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

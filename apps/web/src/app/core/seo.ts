import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { CATEGORY_LABEL, STORES } from '@napa/connectors';
import type { Offer } from '@napa/deals-engine';
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
    const live = offers.filter((o) => o.source === 'live');
    const first = live[0];
    if (!first) return null;
    const prices = live.map((o) => o.price);
    const valid = new Date(
      Math.max(...live.map((o) => Date.parse(o.observedAt) || 0)) + 7 * 86_400_000,
    )
      .toISOString()
      .slice(0, 10);
    const each = live.map((o) => ({
      '@type': 'Offer',
      url: o.url,
      price: o.price,
      priceCurrency: 'COP',
      priceValidUntil: valid,
      availability: 'https://schema.org/InStock',
      seller: { '@type': 'Organization', name: STORES[o.storeId]?.name ?? o.storeId },
    }));
    return {
      '@type': 'Product',
      name: first.title,
      ...(first.brand ? { brand: { '@type': 'Brand', name: first.brand } } : {}),
      ...(first.image ? { image: [first.image] } : {}),
      category: CATEGORY_LABEL[first.category] ?? first.category,
      url: this.url(`producto/${encodeURIComponent(first.productKey)}`),
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

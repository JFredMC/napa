import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  input,
  output,
  viewChild,
  type OnDestroy,
} from '@angular/core';
import { STORES } from '@napa/connectors';
import type { LatLng } from '@napa/deals-engine';
import type { Map as MlMap, Marker } from 'maplibre-gl';
import { ThemeStore } from '../../core/theme.store';
import type { Place } from '../../core/location.store';

type MapLibre = typeof import('maplibre-gl');

interface DrawArgs {
  center: LatLng;
  radius: number;
  places: Place[];
  style: string;
  selected: string | null;
}

const STYLE = {
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
};

/** Carga la hoja de estilos de MapLibre solo en esta página (no pesa en el resto de la app). */
function ensureCss(): void {
  if (document.getElementById('maplibre-css')) return;
  const link = document.createElement('link');
  link.id = 'maplibre-css';
  link.rel = 'stylesheet';
  link.href = 'vendor/maplibre-gl.css';
  document.head.appendChild(link);
}

/** Mapa MapLibre con teselas vectoriales de CARTO (sin llaves) y datos de OpenStreetMap. */
@Component({
  selector: 'app-map-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div
    #host
    class="map"
    role="region"
    aria-label="Mapa de tiendas cercanas"
    data-testid="map"
  ></div>`,
})
export class MapView implements OnDestroy {
  readonly center = input.required<LatLng>();
  readonly radius = input.required<number>();
  readonly places = input.required<Place[]>();
  readonly selected = input<string | null>(null);
  readonly pick = output<string>();

  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private readonly theme = inject(ThemeStore);
  private map: MlMap | null = null;
  private markers: Marker[] = [];
  private lib: MapLibre | null = null;
  private currentStyle: string | null = null;

  private pending: DrawArgs | null = null;
  private loading = false;

  constructor() {
    effect(() => {
      this.pending = {
        center: this.center(),
        radius: this.radius(),
        places: this.places(),
        style: STYLE[this.theme.theme()],
        selected: this.selected(),
      };
      if (this.lib) this.draw(this.pending);
      else void this.loadLib();
    });
  }

  /** Carga MapLibre una sola vez y dibuja el último estado pedido (evita carreras entre renders). */
  private async loadLib(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    ensureCss();
    // maplibre-gl es CommonJS: según el empaquetador llega como `default` o como el propio módulo.
    const mod = (await import('maplibre-gl')) as MapLibre & { default?: MapLibre };
    this.lib = mod.default ?? mod;
    if (this.pending) this.draw(this.pending);
  }

  private draw({ center, radius, places, style, selected }: DrawArgs): void {
    if (!this.lib) return;
    const ml = this.lib;
    if (!this.map) {
      this.map = new ml.Map({
        container: this.host().nativeElement,
        style,
        center: [center.lng, center.lat],
        zoom: 14,
        attributionControl: { compact: true },
        cooperativeGestures: true,
      });
      this.map.addControl(new ml.NavigationControl({ showCompass: false }), 'top-right');
      this.currentStyle = style;
    } else if (this.currentStyle !== style) {
      this.map.setStyle(style);
      this.currentStyle = style;
    }
    const map = this.map;
    for (const m of this.markers) m.remove();
    this.markers = [];

    const me = document.createElement('div');
    me.className = 'pin me';
    me.setAttribute('aria-label', 'Tu ubicación');
    this.markers.push(
      new ml.Marker({ element: me }).setLngLat([center.lng, center.lat]).addTo(map),
    );

    for (const p of places) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `pin${p.storeId ? ' known' : ''}${selected === p.id ? ' sel' : ''}`;
      el.style.setProperty('--store', p.storeId ? (STORES[p.storeId]?.color ?? '#888') : '#8a94a6');
      el.title = p.name;
      el.setAttribute('aria-label', `${p.name}, ${Math.round(p.distanceKm * 1000)} m`);
      el.dataset['testid'] = 'pin';
      el.addEventListener('click', () => this.pick.emit(p.id));
      this.markers.push(
        new ml.Marker({ element: el, anchor: 'bottom' }).setLngLat([p.lng, p.lat]).addTo(map),
      );
    }

    const sel = places.find((p) => p.id === selected);
    if (sel) {
      map.easeTo({ center: [sel.lng, sel.lat], zoom: Math.max(map.getZoom(), 15) });
    } else {
      const dLat = radius / 111_320;
      const dLng = radius / (111_320 * Math.cos((center.lat * Math.PI) / 180));
      map.fitBounds(
        [
          [center.lng - dLng, center.lat - dLat],
          [center.lng + dLng, center.lat + dLat],
        ],
        { padding: 24, duration: 0 },
      );
    }
  }

  ngOnDestroy(): void {
    this.pending = null;
    for (const m of this.markers) m.remove();
    this.map?.remove();
    this.map = null;
  }
}

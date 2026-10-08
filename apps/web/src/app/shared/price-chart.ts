import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import type { PricePoint } from '@napa/deals-engine';
import { cop, copShort, shortDate } from '../core/format';

const W = 640;
const H = 220;
const PAD = { l: 64, r: 16, t: 16, b: 28 };

/** Historial de precio en SVG: precio diario, precio habitual y precio "antes" que anuncia la tienda. */
@Component({
  selector: 'app-price-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (geo(); as g) {
      <figure class="chart" data-testid="price-chart">
        <svg
          [attr.viewBox]="'0 0 ' + W + ' ' + H"
          role="img"
          [attr.aria-label]="
            'Historial de ' +
            points().length +
            ' días: mínimo ' +
            cop(g.min) +
            ', máximo ' +
            cop(g.max)
          "
          (pointermove)="hover($event)"
          (pointerleave)="active.set(null)"
        >
          @for (t of g.ticks; track t.v) {
            <line
              class="grid"
              [attr.x1]="PAD.l"
              [attr.x2]="W - PAD.r"
              [attr.y1]="t.y"
              [attr.y2]="t.y"
            />
            <text class="axis" [attr.x]="PAD.l - 8" [attr.y]="t.y + 4" text-anchor="end">
              {{ copShort(t.v) }}
            </text>
          }
          @for (d of g.dates; track d.x) {
            <text class="axis" [attr.x]="d.x" [attr.y]="H - 8" [attr.text-anchor]="d.anchor">
              {{ d.label }}
            </text>
          }
          @if (g.listY !== null) {
            <line
              class="list"
              [attr.x1]="PAD.l"
              [attr.x2]="W - PAD.r"
              [attr.y1]="g.listY"
              [attr.y2]="g.listY"
            />
            <text class="tag list-t" [attr.x]="W - PAD.r" [attr.y]="g.listY - 6" text-anchor="end">
              “Antes” {{ cop(listPrice()!) }}
            </text>
          }
          @if (g.usualY !== null) {
            <line
              class="usual"
              [attr.x1]="PAD.l"
              [attr.x2]="W - PAD.r"
              [attr.y1]="g.usualY"
              [attr.y2]="g.usualY"
            />
            <text class="tag usual-t" [attr.x]="PAD.l + 6" [attr.y]="g.usualY - 6">
              Habitual {{ cop(usual()!) }}
            </text>
          }
          <path class="area" [attr.d]="g.area" />
          <path class="line" [attr.d]="g.line" />
          <circle class="now" [attr.cx]="g.last.x" [attr.cy]="g.last.y" r="4.5" />
          @if (active(); as a) {
            <line
              class="cursor"
              [attr.x1]="a.x"
              [attr.x2]="a.x"
              [attr.y1]="PAD.t"
              [attr.y2]="H - PAD.b"
            />
            <circle class="dot" [attr.cx]="a.x" [attr.cy]="a.y" r="4" />
          }
        </svg>
        <figcaption class="small">
          @if (active(); as a) {
            <span class="num"
              ><b>{{ cop(a.price) }}</b> · {{ a.label }}</span
            >
          } @else {
            <span><i class="sw line"></i>Precio diario</span>
            @if (usual()) {
              <span><i class="sw usual"></i>Precio habitual</span>
            }
            @if (listPrice()) {
              <span><i class="sw list"></i>Precio “antes”</span>
            }
          }
        </figcaption>
      </figure>
    }
  `,
})
export class PriceChart {
  readonly points = input.required<PricePoint[]>();
  readonly usual = input<number | null>(null);
  readonly listPrice = input<number | null>(null);
  protected readonly W = W;
  protected readonly H = H;
  protected readonly PAD = PAD;
  protected readonly cop = cop;
  protected readonly copShort = copShort;
  protected readonly active = signal<{ x: number; y: number; price: number; label: string } | null>(
    null,
  );

  protected readonly geo = computed(() => {
    const pts = this.points();
    if (pts.length < 2) return null;
    const prices = pts.map((p) => p.price);
    const extra = [this.usual(), this.listPrice()].filter((v): v is number => !!v);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    let lo = Math.min(min, ...extra);
    let hi = Math.max(max, ...extra);
    const span = hi - lo || hi * 0.1 || 1;
    lo -= span * 0.12;
    hi += span * 0.12;
    const x = (i: number) => PAD.l + (i / (pts.length - 1)) * (W - PAD.l - PAD.r);
    const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
    // Línea escalonada: el precio se mantiene hasta el cambio siguiente.
    let line = `M${x(0).toFixed(1)},${y(prices[0]!).toFixed(1)}`;
    for (let i = 1; i < pts.length; i += 1) {
      line += `H${x(i).toFixed(1)}V${y(prices[i]!).toFixed(1)}`;
    }
    const area = `${line}V${H - PAD.b}H${PAD.l}Z`;
    const ticks = [0, 0.5, 1].map((f) => {
      const v = lo + (hi - lo) * (0.12 / 1.24 + f * (1 / 1.24));
      return { v, y: y(v) };
    });
    const n = pts.length - 1;
    const dates = [0, Math.round(n / 2), n].map((i, k) => ({
      x: x(i),
      label: shortDate(pts[i]!.date),
      anchor: k === 0 ? 'start' : k === 2 ? 'end' : 'middle',
    }));
    return {
      min,
      max,
      line,
      area,
      ticks,
      dates,
      last: { x: x(n), y: y(prices[n]!) },
      usualY: this.usual() ? y(this.usual()!) : null,
      listY: this.listPrice() && this.listPrice()! > prices[n]! ? y(this.listPrice()!) : null,
      x,
      y,
    };
  });

  protected hover(e: PointerEvent): void {
    const g = this.geo();
    const svg = e.currentTarget as SVGSVGElement;
    if (!g) return;
    const rect = svg.getBoundingClientRect();
    const vx = ((e.clientX - rect.left) / rect.width) * W;
    const pts = this.points();
    const i = Math.round(((vx - PAD.l) / (W - PAD.l - PAD.r)) * (pts.length - 1));
    const p = pts[Math.min(pts.length - 1, Math.max(0, i))];
    if (!p) return;
    const idx = pts.indexOf(p);
    this.active.set({ x: g.x(idx), y: g.y(p.price), price: p.price, label: shortDate(p.date) });
  }
}

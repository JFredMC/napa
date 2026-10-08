import { Injectable, effect, signal } from '@angular/core';

export type Theme = 'dark' | 'light';
const KEY = 'napa:theme';

/** Tema claro u oscuro. El valor inicial lo pone un script en index.html para evitar parpadeo. */
@Injectable({ providedIn: 'root' })
export class ThemeStore {
  readonly theme = signal<Theme>(
    typeof document !== 'undefined' && document.documentElement.dataset['theme'] === 'light'
      ? 'light'
      : 'dark',
  );

  constructor() {
    effect(() => {
      const t = this.theme();
      document.documentElement.dataset['theme'] = t;
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', t === 'light' ? '#f4f7fc' : '#070d18');
      try {
        localStorage.setItem(KEY, t);
      } catch {
        /* ignore */
      }
    });
  }

  toggle(): void {
    this.theme.update((t) => (t === 'dark' ? 'light' : 'dark'));
  }
}

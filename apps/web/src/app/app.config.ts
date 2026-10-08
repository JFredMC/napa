import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { API_URL, DEALS_MODE, resolveMode } from './core/mode';

const mode = resolveMode(
  environment.apiUrl,
  typeof localStorage === 'undefined' ? undefined : localStorage,
  location.search,
);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
    ),
    { provide: API_URL, useValue: environment.apiUrl },
    { provide: DEALS_MODE, useValue: mode },
  ],
};

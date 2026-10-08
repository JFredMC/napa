import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { API_URL, MODE_PREFERENCE, resolvePreference } from './core/mode';

const preference = resolvePreference(
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
    { provide: MODE_PREFERENCE, useValue: preference },
  ],
};

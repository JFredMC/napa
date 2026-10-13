import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import type { FetchLike } from '@napa/connectors';
import { sameSecret } from '../clicks';
import { APP_CONFIG, CLOCK, FETCH, type AppConfig } from '../config';
import { SearchService } from '../search.service';
import {
  checkAlerts,
  cheapest,
  handleUpdate,
  webhookSecret,
  type Reply,
  type TgUpdate,
} from './bot';
import { GistStore, MemoryStore, type AlertStore } from './store';

export const ALERT_STORES = ['jumbo', 'olimpica'];
export const ALERT_STORE = Symbol('ALERT_STORE');

export function alertStoreFactory(config: AppConfig, fetch: FetchLike): AlertStore {
  const a = config.alerts;
  if (a && config.telegram)
    return new GistStore(a.gistId, a.githubToken, config.telegram.botToken, fetch);
  return new MemoryStore();
}

export const COMMANDS = [
  { command: 'alerta', description: 'Seguir un producto: /alerta arroz roa 1kg' },
  { command: 'mis_alertas', description: 'Ver lo que sigues' },
  { command: 'borrar', description: 'Dejar de seguir: /borrar 1' },
  { command: 'ayuda', description: 'Cómo funciona' },
];

@Injectable()
export class AlertsService implements OnApplicationBootstrap {
  private readonly log = new Logger('alertas');
  /** Serializa los cambios de estado (webhooks y revisiones simultáneas). */
  private chain: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly search: SearchService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(FETCH) private readonly fetch: FetchLike,
    @Inject(CLOCK) private readonly clock: () => Date,
    @Inject(ALERT_STORE) readonly store: AlertStore,
  ) {}

  get enabled(): boolean {
    return !!this.config.telegram;
  }

  /** En Render (RENDER_EXTERNAL_URL) registra el webhook y los comandos al arrancar. */
  async onApplicationBootstrap(): Promise<void> {
    const tg = this.config.telegram;
    const base = this.config.publicApiUrl;
    if (!tg || !base) return;
    try {
      await this.api('setWebhook', {
        url: `${base.replace(/\/$/, '')}/api/telegram/webhook`,
        secret_token: webhookSecret(tg.botToken),
        allowed_updates: ['message'],
        max_connections: 5,
      });
      await this.api('setMyCommands', { commands: COMMANDS });
      this.log.log(`webhook de Telegram listo · alertas en ${this.store.kind}`);
    } catch (e) {
      this.log.warn(`no se pudo registrar el webhook: ${(e as Error).message}`);
    }
  }

  private async api(method: string, payload: unknown): Promise<unknown> {
    const tg = this.config.telegram!;
    const res = await this.fetch(`https://api.telegram.org/bot${tg.botToken}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
    // Solo la descripción de Telegram: nunca la URL (lleva el token).
    if (!body.ok)
      throw Object.assign(new Error(body.description ?? String(res.status)), {
        status: res.status,
      });
    return body;
  }

  private lookup = async (q: string) =>
    cheapest((await this.search.search({ q, limit: 24 }, ALERT_STORES)).offers, q);

  private locked<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn, fn);
    this.chain = run.catch(() => undefined);
    return run;
  }

  private async send(replies: Reply[], state: { users: Record<string, unknown> }) {
    let sent = 0;
    for (const r of replies) {
      try {
        await this.api('sendMessage', {
          chat_id: r.chatId,
          text: r.text,
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true },
        });
        sent++;
      } catch (e) {
        // 403: el usuario bloqueó el bot → se olvidan sus alertas.
        if ((e as { status?: number }).status === 403) delete state.users[r.chatId];
        else this.log.warn(`sendMessage: ${(e as Error).message}`);
      }
    }
    return sent;
  }

  handle(update: TgUpdate): Promise<void> {
    return this.locked(async () => {
      const state = await this.store.load();
      const replies = await handleUpdate(
        state,
        update,
        this.lookup,
        this.clock(),
        this.config.siteUrl,
      );
      if (!replies.length) return;
      await this.send(replies, state);
      await this.store.save(state);
    });
  }

  check(): Promise<{ alerts: number; notified: number }> {
    return this.locked(async () => {
      const state = await this.store.load();
      const replies = await checkAlerts(state, this.lookup, this.clock(), this.config.siteUrl);
      const notified = await this.send(replies, state);
      await this.store.save(state);
      const alerts = Object.values(state.users).reduce((n, u) => n + u.alerts.length, 0);
      return { alerts, notified };
    });
  }
}

@Controller()
export class AlertsController {
  constructor(
    private readonly alerts: AlertsService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Telegram llama aquí con cada mensaje al bot (cabecera secreta derivada del token). */
  @Post('telegram/webhook')
  @HttpCode(200)
  async webhook(
    @Body() update: TgUpdate,
    @Headers('x-telegram-bot-api-secret-token') secret?: string,
  ): Promise<{ ok: true }> {
    const tg = this.config.telegram;
    if (!tg) throw new NotFoundException();
    if (!sameSecret(secret, webhookSecret(tg.botToken))) throw new ForbiddenException();
    await this.alerts.handle(update).catch((e: Error) => new Logger('alertas').warn(e.message));
    return { ok: true };
  }

  /** POST /api/alerts/check con `Authorization: Bearer <ADMIN_TOKEN>` (lo llama el cron). */
  @Post('alerts/check')
  @HttpCode(200)
  check(@Headers('authorization') auth?: string) {
    if (!this.config.adminToken || !this.config.telegram) throw new NotFoundException();
    if (!sameSecret(auth?.replace(/^Bearer\s+/i, ''), this.config.adminToken))
      throw new UnauthorizedException();
    return this.alerts.check();
  }
}

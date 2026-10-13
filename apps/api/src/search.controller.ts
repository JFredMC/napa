import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { CATEGORY_IDS, STORE_IDS } from '@napa/connectors';
import type { CategoryId } from '@napa/deals-engine';
import { AlertsService } from './alerts/alerts';
import { SearchService, type SearchResult, type SourceStatus } from './search.service';

@Controller()
export class SearchController {
  constructor(
    private readonly search: SearchService,
    private readonly alerts: AlertsService,
  ) {}

  /** GET /api/search?q=arroz&category=despensa&stores=jumbo,olimpica&limit=24 */
  @Get('search')
  async find(
    @Query('q') q = '',
    @Query('category') category?: string,
    @Query('stores') stores?: string,
    @Query('limit') limit?: string,
  ): Promise<SearchResult> {
    if (typeof q !== 'string' || q.length > 80)
      throw new BadRequestException('q debe tener máximo 80 caracteres');
    if (category && !CATEGORY_IDS.includes(category as CategoryId))
      throw new BadRequestException('Categoría desconocida');
    const n = limit === undefined ? 24 : Number(limit);
    if (!Number.isInteger(n) || n < 1 || n > 48)
      throw new BadRequestException('limit debe estar entre 1 y 48');
    const ids = stores ? stores.split(',').filter((s) => STORE_IDS.includes(s)) : STORE_IDS;
    return this.search.search(
      { q: q.trim(), limit: n, ...(category ? { category: category as CategoryId } : {}) },
      ids,
    );
  }

  /** GET /api/sources: qué tiendas son reales, bloqueadas o simuladas, y por qué. */
  @Get('sources')
  sources(): Promise<SourceStatus[]> {
    return this.search.sources();
  }

  @Get('health')
  health(): { status: 'ok'; telegram: boolean; alerts: 'gist' | 'memory' | 'off' } {
    return {
      status: 'ok',
      telegram: this.alerts.enabled,
      alerts: this.alerts.enabled ? this.alerts.store.kind : 'off',
    };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ObservabilityService } from '../observability/observability.service';
import { RefreshRankingsService } from './refresh-rankings.service';

/**
 * Disparador del cron `refresh-rankings`.
 *
 * Sustituye al workflow de GitHub Actions que ejecutaba el endpoint Vercel
 * `/api/cron/refresh-rankings` cada 5 minutos. Aquí el scheduler es in-app
 * y el job corre sin límite de duración (vs `maxDuration = 60` en Vercel).
 *
 * Emite a `observable_events` (Bloque 4): un evento por cada run con
 * éxito/error + duración + filas insertadas. Es el primer cron que emite
 * — validar el patrón antes de propagar a los otros 12.
 */
@Injectable()
export class RefreshRankingsCron {
  private readonly logger = new Logger(RefreshRankingsCron.name);

  constructor(
    private readonly service: RefreshRankingsService,
    private readonly observability: ObservabilityService,
  ) {}

  @Cron('*/5 * * * *', { name: 'refresh-rankings', timeZone: 'UTC' })
  async handle(): Promise<void> {
    this.logger.log('Cron refresh-rankings disparado');
    const startedAt = Date.now();
    try {
      const result = await this.service.run();
      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'info',
        eventType: 'cron_run',
        endpoint: 'refresh-rankings',
        durationMs: Date.now() - startedAt,
        metadata: {
          status: 'success',
          totalInserted: result.totalInserted,
          slowestMs: result.slowestMs,
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Cron refresh-rankings falló: ${errorMessage}`);
      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'refresh-rankings',
        durationMs: Date.now() - startedAt,
        errorMessage,
        metadata: { status: 'failure' },
      });
    }
  }
}

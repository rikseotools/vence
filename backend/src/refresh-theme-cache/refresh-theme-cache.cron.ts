import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ObservabilityService } from '../observability/observability.service';
import { RefreshThemeCacheService } from './refresh-theme-cache.service';

/**
 * Disparador del cron `refresh-theme-cache`.
 *
 * Sustituye al endpoint Vercel `app/api/cron/refresh-theme-cache/route.js`
 * (antes invocado vía GitHub Actions con maxDuration=60s).
 * Aquí corre a las 23:00 UTC sin límite de duración.
 */
@Injectable()
export class RefreshThemeCacheCron {
  private readonly logger = new Logger(RefreshThemeCacheCron.name);

  constructor(
    private readonly service: RefreshThemeCacheService,
    private readonly observability: ObservabilityService,
  ) {}

  @Cron('0 23 * * *', { name: 'refresh-theme-cache', timeZone: 'UTC' })
  async handle(): Promise<void> {
    this.logger.log('Cron refresh-theme-cache disparado');
    const startedAt = Date.now();
    try {
      const result = await this.service.run();
      await this.observability.emit({
        source: 'fargate',
        severity: 'info',
        eventType: 'cron_run',
        endpoint: 'refresh-theme-cache',
        durationMs: Date.now() - startedAt,
        metadata: {
          status: 'success',
          totalUsers: result.totalUsers,
          usersProcessed: result.usersProcessed,
          totalTopics: result.totalTopics,
          errors: result.errors,
          durationSeconds: result.durationSeconds,
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Cron refresh-theme-cache falló: ${errorMessage}`);
      await this.observability.emit({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'refresh-theme-cache',
        durationMs: Date.now() - startedAt,
        errorMessage,
        metadata: { status: 'failure' },
      });
    }
  }
}

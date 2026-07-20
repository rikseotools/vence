// canary-runner.service.ts — Ejecuta un CanaryProbe y emite su observabilidad de
// forma UNIFORME. Sustituye el bloque runImpl (cronometrar + switch→emit + cron_run)
// que hoy está copiado en cada `.cron.ts`. Un canary migrado deja su cron reducido a:
//   await this.runner.run(this.service)
// (manteniendo su @Cron + registro de heartbeat + jitter propios).
//
// Diseño: docs/roadmap/canary-framework.md (P1.2).

import { Injectable, Logger } from '@nestjs/common';
import { ObservabilityService } from '../observability/observability.service';
import { canaryOutcomeEvent, cronRunEvent } from './canary-emit';
import { CanaryProbe } from './canary-probe';
import { CanaryResult } from './canary-result';

@Injectable()
export class CanaryRunnerService {
  private readonly logger = new Logger(CanaryRunnerService.name);

  constructor(private readonly observability: ObservabilityService) {}

  /**
   * Ejecuta el probe, cronometra, y emite: (1) el evento de resultado
   * `canary_<eventBase>_<status>` con su severidad, y (2) `cron_run` (liveness).
   * NUNCA lanza — un fallo del propio runner se reporta como `cron_run` de error y
   * un CanaryResult 'failed' (para no tumbar el scheduler del cron que lo invoca).
   */
  async run(probe: CanaryProbe): Promise<CanaryResult> {
    const startedAt = Date.now();
    try {
      const partial = await probe.execute();
      const result: CanaryResult = { ...partial, durationMs: Date.now() - startedAt };
      this.observability.emitFireAndForget(canaryOutcomeEvent(probe, result));
      this.observability.emitFireAndForget(cronRunEvent(probe.name, Date.now() - startedAt, 'completed'));
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Canary "${probe.name}" lanzó en execute(): ${errorMessage}`);
      this.observability.emitFireAndForget(cronRunEvent(probe.name, Date.now() - startedAt, 'failure', errorMessage));
      return { status: 'failed', step: 'runner_exception', errorMessage, durationMs: Date.now() - startedAt };
    }
  }
}

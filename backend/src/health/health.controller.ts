import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { OutboxProcessorCron } from '../outbox-processor/outbox-processor.cron';

interface HealthResponse {
  status: 'ok';
  service: string;
  timestamp: string;
}

interface OutboxHealthResponse {
  alive: boolean;
  lastTickMsAgo: number | null;
  thresholdMs: number;
  timestamp: string;
}

/**
 * Endpoints de salud.
 *
 * - `GET /health` — liveness simple del proceso (ALB target health).
 * - `GET /health/outbox` — liveness del worker outbox-processor.
 *   Devuelve 200 si el worker tickeo recientemente; 503 si silencioso > umbral.
 *   Usado como ECS liveness probe (configurada en task definition).
 *   Cuando devuelve 503 N veces seguidas, ECS mata el container y relanza.
 */
@Controller('health')
export class HealthController {
  /** Umbral por defecto de silencio del worker (30s = 6 ticks × 5s). */
  private static readonly OUTBOX_SILENCE_THRESHOLD_MS = 30_000;

  constructor(private readonly outboxCron: OutboxProcessorCron) {}

  @Get()
  check(): HealthResponse {
    return {
      status: 'ok',
      service: 'vence-backend',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Liveness probe del worker outbox-processor.
   *
   * Diseño profesional (post-incidente cuelgue 29/05 21:54 UTC):
   * - 200 OK: worker tickeo en <= 30s. Container sano.
   * - 503 SERVICE UNAVAILABLE: worker silencioso. ECS reintentará N veces
   *   (configurado en task definition healthCheck.retries) y matará el
   *   container si N consecutivos fallan.
   *
   * El threshold debe ser > 2× el interval del @Interval del worker (5s)
   * para tolerar latencia normal de procesamiento. 30s = 6 intervalos OK.
   */
  @Get('outbox')
  checkOutbox(@Res() res: Response): void {
    const lastTickMsAgo = this.outboxCron.getLastTickMsAgo();
    const thresholdMs = HealthController.OUTBOX_SILENCE_THRESHOLD_MS;
    const alive = lastTickMsAgo !== null && lastTickMsAgo <= thresholdMs;

    const body: OutboxHealthResponse = {
      alive,
      lastTickMsAgo,
      thresholdMs,
      timestamp: new Date().toISOString(),
    };

    res
      .status(alive ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE)
      .json(body);
  }
}

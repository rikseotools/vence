import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
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

interface CronsHealthResponse {
  alive: boolean;
  processUptimeMs: number;
  crons: Record<string, number | null>;
  stale: Array<{ name: string; lastTickMsAgo: number | null; thresholdMs: number }>;
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

  /**
   * Grace period inicial del proceso. Durante este tiempo, /health/outbox
   * devuelve 200 aunque lastTickAtMs sea null — NestJS bootstrap en backend
   * con ~30+ módulos tarda ~30-60s. Si lo devolviéramos 503, el ECS liveness
   * probe mataría el container antes de que llegue a estar operativo.
   *
   * Tras este grace period, si sigue null → worker no arrancó → 503 legítimo.
   */
  private static readonly STARTUP_GRACE_MS = 120_000; // 2 min

  /** Timestamp del arranque del proceso (Date.now() del primer import). */
  private readonly startedAtMs = Date.now();

  constructor(
    private readonly outboxCron: OutboxProcessorCron,
    private readonly heartbeatRegistry: HeartbeatRegistry,
  ) {}

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
    const processUptimeMs = Date.now() - this.startedAtMs;
    const inGracePeriod = processUptimeMs < HealthController.STARTUP_GRACE_MS;

    // Estados posibles:
    //   1. Tick reciente (< threshold) → alive=true
    //   2. Sin tick aún PERO dentro de grace period → alive=true (starting)
    //   3. Sin tick PERO pasado grace period → alive=false (worker no arrancó)
    //   4. Último tick > threshold → alive=false (worker colgado)
    const tickRecent = lastTickMsAgo !== null && lastTickMsAgo <= thresholdMs;
    const alive = tickRecent || (lastTickMsAgo === null && inGracePeriod);

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

  /**
   * Liveness agregada de TODOS los crons registrados en HeartbeatRegistry.
   * - 200 OK si TODOS los crons están healthy (tick reciente o en grace period).
   * - 503 SERVICE UNAVAILABLE si AL MENOS UNO está silencioso > threshold.
   *
   * Este es el endpoint que la ECS liveness probe debe consultar (no /health/outbox,
   * que es legacy single-cron). Si CUALQUIER cron crítico cuelga, ECS mata el
   * container y relanza — auto-recovery sistémico.
   *
   * Diseño profesional post-incidente cuelgue worker 29/05 21:54 UTC:
   * los 20+ crons del backend comparten el mismo riesgo de cuelgue silencioso.
   * Centralizando el monitoreo evitamos depender de N watchdogs distintos.
   */
  @Get('crons')
  checkAllCrons(@Res() res: Response): void {
    const stale = this.heartbeatRegistry.getStaleCrons();
    const body: CronsHealthResponse = {
      alive: stale.length === 0,
      processUptimeMs: this.heartbeatRegistry.getProcessUptimeMs(),
      crons: this.heartbeatRegistry.getAllSnapshot(),
      stale,
      timestamp: new Date().toISOString(),
    };
    res
      .status(stale.length === 0 ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE)
      .json(body);
  }
}

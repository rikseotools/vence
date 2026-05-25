import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';

export type EventSeverity = 'debug' | 'info' | 'warn' | 'error' | 'critical';

export type EventSource = 'vercel' | 'fargate' | 'gha' | 'frontend';

export interface ObservableEvent {
  /** Origen del evento. Para Fargate NestJS = 'fargate'. */
  source: EventSource;
  /** Severidad. */
  severity: EventSeverity;
  /** Categoría: 'http_5xx', 'cron_run', 'deploy', 'cache_invalidation', etc. */
  eventType: string;
  endpoint?: string | null;
  userId?: string | null;
  deployVersion?: string | null;
  durationMs?: number | null;
  httpStatus?: number | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown> | null;
  /** Timestamp. Default NOW(). */
  ts?: Date;
}

/**
 * Emisor de eventos observables desde el backend NestJS/Fargate.
 *
 * Bloque 4 del docs/ARCHITECTURE_ROADMAP.md — tabla `observable_events`
 * unificada (reemplaza CloudWatch + validation_error_logs + Sentry
 * fragmentados).
 *
 * Escribe DIRECTAMENTE vía Drizzle (mismo patrón que el frontend
 * `lib/observability/emit.ts`). Cross-runtime coherente: misma tabla,
 * mismo shape, query unificada en dashboard futuro.
 *
 * Patrón fire-and-forget: NUNCA bloquea la respuesta. Si la BD cae, el
 * evento se pierde (aceptable) y se loguea a `Logger.warn` para
 * detección secundaria via CloudWatch.
 */
@Injectable()
export class ObservabilityService {
  private readonly logger = new Logger(ObservabilityService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /**
   * Emite un evento. Fire-and-forget — no bloquea al caller.
   *
   * @example
   *   constructor(private readonly obs: ObservabilityService) {}
   *   ...
   *   await this.obs.emit({
   *     source: 'fargate', severity: 'error', eventType: 'http_5xx',
   *     endpoint: '/api/v2/answer-and-save', httpStatus: 503,
   *     errorMessage: 'BD timeout', durationMs: 15000,
   *   });
   */
  async emit(event: ObservableEvent): Promise<void> {
    try {
      await this.db.execute(sql`
        INSERT INTO public.observable_events (
          ts, source, severity, event_type, endpoint, user_id,
          deploy_version, duration_ms, http_status, error_message, metadata
        ) VALUES (
          COALESCE(${event.ts ?? null}, NOW()),
          ${event.source},
          ${event.severity},
          ${event.eventType},
          ${event.endpoint ?? null},
          ${event.userId ?? null}::uuid,
          ${event.deployVersion ?? null},
          ${event.durationMs ?? null},
          ${event.httpStatus ?? null},
          ${event.errorMessage ?? null},
          ${event.metadata ? JSON.stringify(event.metadata) : null}::jsonb
        )
      `);
    } catch (err) {
      // NUNCA propagar — observabilidad no debe romper requests reales
      this.logger.warn(
        `emit() falló: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Variant fire-and-forget — no espera la promise. Útil para emit
   * dentro de catch blocks no-async o background work.
   */
  emitFireAndForget(event: ObservableEvent): void {
    this.emit(event).catch(() => {
      /* ya logueado */
    });
  }
}

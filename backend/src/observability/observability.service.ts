import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';

export type EventSeverity = 'debug' | 'info' | 'warn' | 'error' | 'critical';

export type EventSource = 'vercel' | 'fargate' | 'gha' | 'frontend';

/**
 * Normaliza severity para CHECK constraint. Acepta variantes obvias
 * (warning→warn, fatal→critical, err→error). Cualquier valor no
 * reconocido se trata como 'warn' (conservador — no inflar críticas
 * accidentalmente).
 */
function normalizeSeverity(s: string): EventSeverity {
  const lower = String(s).toLowerCase();
  if (lower === 'warning') return 'warn';
  if (lower === 'fatal' || lower === 'crit') return 'critical';
  if (lower === 'err') return 'error';
  if (['debug', 'info', 'warn', 'error', 'critical'].includes(lower)) {
    return lower as EventSeverity;
  }
  return 'warn';
}

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
  // Timeout máximo para el INSERT. Sin esto, una conexión colgada en
  // wait=Client/ClientRead acumula slot zombie en el pool postgres-js
  // (max 7-8) → cascada de 503 en endpoints reales. Incidente 27/05/2026
  // documentado en docs/runbooks/observability.md §"⚠️ FOOTGUN".
  // 5s es conservador: INSERT normal <5ms; si tarda >5s hay problema upstream
  // y mejor perder el evento (rechazo via timeout → catch → log warn) que
  // dejar la conexión zombie indefinidamente.
  // Subido 5s → 15s tras incidente 30/05: durante picos de carga (crons daily
  // que hacen queries pesadas, p. ej. UpdateStreaksService a las 03:00 UTC),
  // el pool BD se queda sin conexiones libres y el INSERT espera más de 5s.
  // CloudWatch mostraba 15+ warns "emit() timeout >5000ms" en 5 segundos.
  // Resultado: los crons SÍ corrían pero NO emitían cron_run → falsa alarma
  // cron_overdue. 15s permite sobrevivir picos sin perder señal.
  // Trade-off: si BD realmente está muerta, el cron tarda 15s extra por emit.
  // Aceptable porque sólo afecta a la observabilidad, no a la lógica.
  private static readonly EMIT_TIMEOUT_MS = 15_000;

  async emit(event: ObservableEvent): Promise<void> {
    try {
      const severity = normalizeSeverity(event.severity);
      const insertPromise = this.db.execute(sql`
        INSERT INTO public.observable_events (
          ts, source, severity, event_type, endpoint, user_id,
          deploy_version, duration_ms, http_status, error_message, metadata
        ) VALUES (
          COALESCE(${event.ts ?? null}, NOW()),
          ${event.source},
          ${severity},
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

      // Promise.race con timeout manual. Drizzle execute no acepta AbortSignal
      // directamente y postgres-js statement_timeout no aborta Client/ClientRead.
      // El timeout aquí asegura que el await SIEMPRE resuelve o rechaza en <=5s,
      // por lo que el slot postgres-js se libera y el pool no acumula zombies.
      // NOTA: el INSERT puede seguir corriendo en BD aunque hagamos timeout aquí —
      // eso es aceptable (la fila se inserta o no, pérdida de evento OK).
      await Promise.race([
        insertPromise,
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`emit() timeout >${ObservabilityService.EMIT_TIMEOUT_MS}ms`)),
            ObservabilityService.EMIT_TIMEOUT_MS,
          ),
        ),
      ]);
    } catch (err) {
      // NUNCA propagar — observabilidad no debe romper requests reales.
      // Incluye los timeouts del Promise.race arriba: si la BD no responde
      // en 5s, perdemos el evento pero NO bloqueamos el pool.
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

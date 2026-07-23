import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';
import { CanaryProbe, CanaryBounding } from '../canary-shared/canary-probe';
import { CanaryResult, CanaryResults } from '../canary-shared/canary-result';

/**
 * Canary pdf-queue — vigila la cola de pre-generación de PDFs del temario
 * (`temario_pdf_jobs`), el PUNTO CIEGO que dejó acumular 27 pending + 12 DLQ
 * en silencio (22-23/07): la función `pdfQueueHealth()` existía pero NADIE en
 * producción la leía (único consumidor: el CLI manual `pdf-worker.ts stats`).
 * Este canary la consume cada 15 min y ALERTA si la cola está rota.
 *
 * Invariante vigilado (cualquiera de estos ⇒ FAILED / critical):
 *   - DLQ: hay jobs 'failed' → un tema no se pudo pre-generar tras reintentos.
 *   - stale-running: un 'running' claimed hace > STALE → el worker murió a media
 *     renderización y el tema quedó colgado.
 *   - backlog estancado: el 'pending' más viejo supera MAX_PENDING_AGE (varios
 *     ciclos del scheduler) → el worker no drena / no corre.
 *
 * Read-only: solo SELECT sobre temario_pdf_jobs. No duplica CI — es estado de
 * runtime de una cola en prod, no un invariante que los tests puedan cubrir.
 */
@Injectable()
export class CanaryPdfQueueService implements CanaryProbe {
  private readonly logger = new Logger(CanaryPdfQueueService.name);

  // ── Contrato CanaryProbe (metadatos declarativos; ver canary-registry.ts) ──
  readonly name = 'pdf-queue';
  readonly eventBase = 'pdf_queue'; // canary_pdf_queue_* → RULE_CANARY_PDF_QUEUE_FAILED
  readonly cadence = '*/15 * * * *';
  readonly writesToProd = false;
  readonly bounding: CanaryBounding = 'read-only';

  // 30 min = DEFAULT_STALE_SECONDS del worker: un 'running' más viejo = worker muerto.
  private readonly STALE_RUNNING_SECONDS = 30 * 60;
  // El worker corre cada 15 min; un 'pending' de >2h (8 ciclos) = no se está drenando.
  private readonly MAX_PENDING_AGE_SECONDS = 2 * 60 * 60;

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async execute(): Promise<Omit<CanaryResult, 'durationMs'>> {
    // db.execute (postgres-js) devuelve un array de filas directamente.
    const res = (await this.db.execute(sql`
      SELECT
        count(*) FILTER (WHERE status = 'pending')::int AS pending,
        count(*) FILTER (WHERE status = 'failed')::int AS dlq,
        count(*) FILTER (WHERE status = 'running'
          AND claimed_at < now() - make_interval(secs => ${this.STALE_RUNNING_SECONDS}))::int AS stale_running,
        COALESCE(
          EXTRACT(EPOCH FROM (now() - min(created_at) FILTER (WHERE status = 'pending')))::int,
          0
        ) AS oldest_pending_sec
      FROM temario_pdf_jobs
    `)) as unknown as Array<{
      pending: number;
      dlq: number;
      stale_running: number;
      oldest_pending_sec: number;
    }>;

    const row = res[0] ?? { pending: 0, dlq: 0, stale_running: 0, oldest_pending_sec: 0 };
    const pending = Number(row.pending ?? 0);
    const dlq = Number(row.dlq ?? 0);
    const staleRunning = Number(row.stale_running ?? 0);
    const oldestPendingSec = Number(row.oldest_pending_sec ?? 0);

    const backlogStuck = pending > 0 && oldestPendingSec > this.MAX_PENDING_AGE_SECONDS;
    const metadata = { pending, dlq, staleRunning, oldestPendingSec };

    if (dlq > 0 || staleRunning > 0 || backlogStuck) {
      const reasons: string[] = [];
      if (dlq > 0) reasons.push(`${dlq} en DLQ`);
      if (staleRunning > 0) reasons.push(`${staleRunning} running colgado(s)`);
      if (backlogStuck) reasons.push(`backlog estancado (${Math.round(oldestPendingSec / 60)} min)`);
      return CanaryResults.failed('pdf_queue_unhealthy', reasons.join('; '), { metadata });
    }
    return CanaryResults.ok({ metadata });
  }
}

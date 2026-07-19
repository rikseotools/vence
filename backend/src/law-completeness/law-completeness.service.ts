import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';
import { ObservabilityService } from '../observability/observability.service';

export interface CompletenessSweepResult {
  total: number;
  servingLive: number;
  byState: Record<string, number>;
  previousServingLive: number | null;
  regressed: boolean;
}

/**
 * Barrido de completitud de leyes vs fuente (Capa 4 del sistema, cierre del loop).
 *
 * Lee la VISTA `law_verification_effective` (estado honesto derivado de la
 * evidencia, no del label) y emite un snapshot a `observable_events`. Es PURO DB
 * (sin fetch ni pdftotext) → 100% fiable en el contenedor.
 *
 * Valor self-healing: **detecta REGRESIÓN**. El guard (no se puede marcar
 * verificado sin evidencia) + el trigger de invalidación (una ley que pierde
 * artículos → `stale`) garantizan que el backlog SOLO puede bajar; este barrido
 * es el vigilante que AVISA si sube (ley nueva sin verificar, o una verificada
 * que derivó). Complementa a `check-boe-changes` (que caza reformas de fecha en
 * leyes BOE, no completitud ni regionales).
 */
@Injectable()
export class LawCompletenessService {
  private readonly logger = new Logger(LawCompletenessService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly observability: ObservabilityService,
  ) {}

  async runSweep(): Promise<CompletenessSweepResult> {
    // 1. Estado honesto por ley (vista) — solo las que sirven en temas vivos.
    const rows = (await this.db.execute(sql`
      SELECT effective_state, count(*)::int AS n
      FROM law_verification_effective
      WHERE serving_live AND effective_state <> 'verified'
      GROUP BY effective_state
    `)) as unknown as Array<{ effective_state: string; n: number }>;

    const byState: Record<string, number> = {};
    let servingLive = 0;
    for (const r of rows) {
      byState[r.effective_state] = Number(r.n);
      servingLive += Number(r.n);
    }
    const [{ total } = { total: 0 }] = (await this.db.execute(sql`
      SELECT count(*)::int AS total FROM laws
    `)) as unknown as Array<{ total: number }>;

    // 2. Snapshot anterior (último law_completeness_swept) para detectar regresión.
    const prev = (await this.db.execute(sql`
      SELECT (metadata->>'serving_live')::int AS prev
      FROM observable_events
      WHERE event_type = 'law_completeness_swept'
      ORDER BY ts DESC
      LIMIT 1
    `)) as unknown as Array<{ prev: number | null }>;
    const previousServingLive =
      prev.length && prev[0].prev != null ? Number(prev[0].prev) : null;
    const regressed =
      previousServingLive != null && servingLive > previousServingLive;

    // 3. Snapshot a observabilidad (tendencia + datos del badge).
    await this.observability.emit({
      source: 'fargate',
      severity: servingLive > 0 ? 'warn' : 'info',
      eventType: 'law_completeness_swept',
      metadata: {
        total: Number(total),
        serving_live: servingLive,
        by_state: byState,
        previous: previousServingLive,
      },
    });

    // 4. Si el backlog SUBIÓ → alerta de regresión (el loop no debería permitirlo).
    if (regressed) {
      this.logger.warn(
        `Regresión de completitud: ${previousServingLive} → ${servingLive} leyes sin verificar`,
      );
      await this.observability.emit({
        source: 'fargate',
        severity: 'error',
        eventType: 'law_completeness_regression',
        metadata: {
          from: previousServingLive,
          to: servingLive,
          by_state: byState,
        },
      });
    }

    this.logger.log(
      `Barrido completitud: ${servingLive} leyes sin verificar (prev ${previousServingLive ?? 'n/a'})`,
    );
    return { total: Number(total), servingLive, byState, previousServingLive, regressed };
  }
}

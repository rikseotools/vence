// backend/src/annulled-vigencia-sweep/annulled-vigencia-sweep.service.ts
//
// T-009 — Barrido que POBLA `articles.vigencia_notes` con los incisos que el TC declaró nulos,
// leyendo el BOE consolidado (API datosabiertos). Cierra el hueco de T-048: el gate
// `answer_falls_in_annulled_fragment` (que impide activar una pregunta cuya clave reproduce un
// inciso anulado) ya está VIVO, pero T-048 solo captura al IMPORTAR → hoy solo 1 artículo tiene
// datos y el gate no protege casi nada. Este barrido rellena retroactivamente las ~357 leyes vivas.
//
// Diseño (capas de seguridad, espejo del loop de completitud):
//   ① Captura (este servicio, semanal, ROTACIÓN por cursor en observable_events → 0 migración):
//      por ley del lote, BOE analisis → qué artículos anuló el TC → bloque → parseo → vigencia_notes.
//      Red acotada (concurrencia + timeout + graceful: una ley que falle no tumba la tanda).
//   ② Regresión: si sube el nº de "bugs vivos" (preguntas activas cuya clave cae en inciso anulado,
//      medido con el propio gate) → evento `annulled_vigencia_regression` (error).
//   ④ Heartbeat: lo registra el cron.
// La detección barata de bugs vivos para el PANEL la hace content-health-sweep (DB-only, diaria).
// El gate (③) ya lo montó T-048 en transition_question_state.

import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';
import { ObservabilityService } from '../observability/observability.service';
import {
  extractTcAnnulments,
  getAnnulledFragments,
  normArticleKey,
  parseBoeBlock,
} from './vigencia-logic';

const BOE_BASE = 'https://www.boe.es/datosabiertos/api/legislacion-consolidada/id';
const BATCH = 80; // leyes por ejecución (ciclo completo de ~357 en ~5 semanas)
const CONCURRENCY = 4; // amable con el BOE
const FETCH_TIMEOUT_MS = 15_000;

export interface VigenciaSweepResult {
  lawsScanned: number;
  lawsWithAnnulment: number;
  articlesCaptured: number;
  liveBugs: number;
  previousLiveBugs: number | null;
  regressed: boolean;
  nextCursor: string;
  cycleWrapped: boolean;
}

@Injectable()
export class AnnulledVigenciaSweepService {
  private readonly logger = new Logger(AnnulledVigenciaSweepService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly observability: ObservabilityService,
  ) {}

  private async boeFetch(url: string, accept: string): Promise<string | null> {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const r = await fetch(url, { headers: { Accept: accept }, signal: ctrl.signal });
      if (!r.ok) return null;
      return await r.text();
    } catch {
      return null; // graceful: red caída / timeout → esta ley se salta, la tanda sigue
    } finally {
      clearTimeout(to);
    }
  }

  private async fetchAnalisis(boeId: string): Promise<any | null> {
    const t = await this.boeFetch(`${BOE_BASE}/${boeId}/analisis`, 'application/json');
    if (!t) return null;
    try {
      return JSON.parse(t);
    } catch {
      return null;
    }
  }

  /** indice → mapa 'artículo N' normalizado → bloque id. */
  private async fetchArticleBlockMap(boeId: string): Promise<Map<string, string> | null> {
    const t = await this.boeFetch(`${BOE_BASE}/${boeId}/texto/indice`, 'application/json');
    if (!t) return null;
    try {
      const j = JSON.parse(t);
      const map = new Map<string, string>();
      for (const b of j?.data?.[0]?.bloque ?? []) {
        const m = String(b?.titulo || '').match(/art[íi]culo\s+(\d+(?:\s*bis)?)/i);
        if (m && b?.id) map.set(normArticleKey(m[1]), b.id);
      }
      return map;
    } catch {
      return null;
    }
  }

  private boeIdFromUrl(boeUrl: string | null): string | null {
    const m = String(boeUrl || '').match(/(BOE-A-\d{4}-\d+)/);
    return m ? m[1] : null;
  }

  /** Cuenta las preguntas ACTIVAS cuya clave cae en un inciso anulado (el propio gate de T-048). */
  private async countLiveBugs(): Promise<number> {
    const rows = (await this.db.execute(sql`
      SELECT count(*)::int AS n
      FROM questions q
      JOIN articles a ON a.id = q.primary_article_id
      WHERE q.is_active AND a.vigencia_notes IS NOT NULL
        AND public.answer_falls_in_annulled_fragment(
          CASE q.correct_option
            WHEN 0 THEN q.option_a WHEN 1 THEN q.option_b
            WHEN 2 THEN q.option_c WHEN 3 THEN q.option_d END,
          a.vigencia_notes) = true
    `)) as unknown as Array<{ n: number }>;
    return Number(rows?.[0]?.n ?? 0);
  }

  async runSweep(): Promise<VigenciaSweepResult> {
    // 1. Cursor de rotación desde el último snapshot (0 migración: vive en observable_events).
    const prevRows = (await this.db.execute(sql`
      SELECT metadata->>'next_cursor' AS cursor, (metadata->>'live_bugs')::int AS bugs
      FROM observable_events
      WHERE event_type = 'annulled_vigencia_swept'
      ORDER BY ts DESC LIMIT 1
    `)) as unknown as Array<{ cursor: string | null; bugs: number | null }>;
    const cursor = prevRows?.[0]?.cursor ?? '';
    const previousLiveBugs = prevRows?.[0]?.bugs ?? null;

    // 2. Lote de leyes nacionales vivas después del cursor; si se acaba, se envuelve (wrap).
    const pick = async (fromCursor: string) =>
      (await this.db.execute(sql`
        SELECT l.id, l.short_name, l.boe_url
        FROM laws l
        WHERE l.is_active = true AND l.boe_url ~* 'BOE-A-'
          AND l.short_name > ${fromCursor}
          AND EXISTS (
            SELECT 1 FROM topic_scope ts JOIN topics t ON t.id = ts.topic_id
            WHERE ts.law_id = l.id AND t.is_active = true
          )
        ORDER BY l.short_name
        LIMIT ${BATCH}
      `)) as unknown as Array<{ id: string; short_name: string; boe_url: string }>;

    let laws = await pick(cursor);
    let cycleWrapped = false;
    if (laws.length === 0 && cursor !== '') {
      laws = await pick(''); // fin del ciclo → volver al principio
      cycleWrapped = true;
    }

    // 3. Procesar el lote con concurrencia acotada.
    let lawsWithAnnulment = 0;
    let articlesCaptured = 0;
    const captured: Array<{ law: string; article: string; stc: string | null }> = [];

    const worker = async (law: { id: string; short_name: string; boe_url: string }) => {
      const boeId = this.boeIdFromUrl(law.boe_url);
      if (!boeId) return;
      const analisis = await this.fetchAnalisis(boeId);
      if (!analisis) return;
      const annuls = extractTcAnnulments(analisis);
      if (annuls.length === 0) return;
      lawsWithAnnulment++;

      // artículos que servimos SIN vigencia_notes y que el TC anuló
      const wantedNums = new Set<string>();
      for (const a of annuls) for (const n of a.articles) wantedNums.add(normArticleKey(n));
      const ourArts = (await this.db.execute(sql`
        SELECT id, article_number FROM articles
        WHERE law_id = ${law.id} AND is_active = true AND vigencia_notes IS NULL
      `)) as unknown as Array<{ id: string; article_number: string }>;
      const byNum = new Map(ourArts.map((r) => [normArticleKey(r.article_number), r]));
      const targets = [...wantedNums].filter((n) => byNum.has(n));
      if (targets.length === 0) return;

      const blockMap = await this.fetchArticleBlockMap(boeId);
      if (!blockMap) return;

      for (const num of targets) {
        const bid = blockMap.get(num);
        if (!bid) continue;
        const raw = await this.boeFetch(`${BOE_BASE}/${boeId}/texto/bloque/${bid}`, 'application/xml');
        if (!raw) continue;
        const block = parseBoeBlock(raw);
        const frags = getAnnulledFragments(block);
        if (frags.length === 0) continue; // el BOE ya no retiene el inciso (reformado) → nada

        const stc = annuls.find((a) => a.articles.some((x) => normArticleKey(x) === num))?.sentencia ?? null;
        const payload = {
          notes: block.vigenciaNotes,
          annulledFragments: frags,
          capturedAt: new Date().toISOString(),
          sourceBlock: bid,
          capturedBy: 'annulled-vigencia-sweep',
        };
        const art = byNum.get(num)!;
        // Aditivo y SOLO si sigue NULL (no pisa capturas manuales/de import). RETURNING para
        // saber sin ambigüedad si escribió (postgres.js no expone rowCount de forma estable).
        const written = (await this.db.execute(sql`
          UPDATE articles SET vigencia_notes = ${JSON.stringify(payload)}::jsonb, updated_at = now()
          WHERE id = ${art.id} AND vigencia_notes IS NULL
          RETURNING id
        `)) as unknown as Array<{ id: string }>;
        if (written.length > 0) {
          articlesCaptured++;
          captured.push({ law: law.short_name, article: art.article_number, stc });
        }
      }
    };

    for (let i = 0; i < laws.length; i += CONCURRENCY) {
      await Promise.all(laws.slice(i, i + CONCURRENCY).map((l) => worker(l).catch(() => undefined)));
    }

    // 4. Métrica de bugs vivos + regresión.
    const liveBugs = await this.countLiveBugs();
    // OJO: durante el backfill, `liveBugs` crece legítimamente al poblar vigencia_notes en
    // más leyes (más datos = más candidatos, incluidos FPs del gate). Solo es REGRESIÓN si
    // sube SIN haber capturado nada nuevo este run → significa una pregunta nueva activada
    // sobre un artículo anulado YA conocido, no ruido del propio backfill.
    const regressed =
      previousLiveBugs != null && liveBugs > previousLiveBugs && articlesCaptured === 0;
    const nextCursor = laws.length > 0 ? laws[laws.length - 1].short_name : '';

    // 5. Snapshot a observabilidad (cursor de rotación + tendencia de bugs).
    await this.observability.emit({
      source: 'fargate',
      severity: 'info',
      eventType: 'annulled_vigencia_swept',
      metadata: {
        laws_scanned: laws.length,
        laws_with_annulment: lawsWithAnnulment,
        articles_captured: articlesCaptured,
        live_bugs: liveBugs,
        previous_live_bugs: previousLiveBugs,
        next_cursor: cycleWrapped ? nextCursor : nextCursor,
        cycle_wrapped: cycleWrapped,
        captured_sample: captured.slice(0, 10),
      },
    });

    if (regressed) {
      this.logger.warn(
        `Regresión incisos anulados: ${previousLiveBugs} → ${liveBugs} preguntas activas con clave en inciso anulado`,
      );
      await this.observability.emit({
        source: 'fargate',
        severity: 'error',
        eventType: 'annulled_vigencia_regression',
        errorMessage: `Bugs de inciso anulado: ${previousLiveBugs} → ${liveBugs}`,
        metadata: { from: previousLiveBugs, to: liveBugs, captured_sample: captured.slice(0, 10) },
      });
    }

    this.logger.log(
      `annulled-vigencia-sweep OK: ${laws.length} leyes (${lawsWithAnnulment} con anulación), ` +
        `${articlesCaptured} artículos capturados, ${liveBugs} bugs vivos` +
        `${regressed ? ' (⚠️ REGRESIÓN)' : ''}${cycleWrapped ? ' [ciclo reiniciado]' : ''}`,
    );

    return {
      lawsScanned: laws.length,
      lawsWithAnnulment,
      articlesCaptured,
      liveBugs,
      previousLiveBugs,
      regressed,
      nextCursor,
      cycleWrapped,
    };
  }
}

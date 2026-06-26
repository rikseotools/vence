import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';
import { signCanaryToken } from '../canary-shared/canary-token';

/**
 * Canary del ENDPOINT de estadísticas por tema (`/api/v2/topic-progress/theme-stats`).
 *
 * Cubre un hueco que ni CI ni los canaries de pipeline detectan: una REGRESIÓN
 * SEMÁNTICA del endpoint que devuelve `success:true` con datos INCOMPLETOS o
 * vacíos (sin error, sin 5xx). Caso real (incidente 19/06): la V4 agrupaba por
 * un `tema_number` estampado y filtraba por `tests.position_type`, excluyendo los
 * tests "globales" → un usuario con 68k respuestas veía su panel casi vacío. La
 * observabilidad no lo vio porque `[]` es indistinguible de "usuario sin
 * progreso". Solo lo cazó un usuario quejándose → justo lo que este canary evita.
 *
 * Los RULE_CANARY_STATS_PIPELINE_FAILED / RULE_MATERIALIZED_STATS_STALE vigilan
 * que user_article_stats esté FRESCO (el pipeline de datos). Este canary vigila
 * que el ENDPOINT TRADUCE bien esos datos a stats por tema (el modelo nuclear
 * artículo→topic_scope), que es donde estuvo el bug.
 *
 * Cada 10 min:
 *   1. Elige el usuario MÁS PESADO con oposición activa (dinámico, auto-mantenido).
 *   2. Calcula desde BD el total ESPERADO de respuestas en el scope de su oposición
 *      (artículo→topic_scope, la fuente de verdad).
 *   3. Llama al endpoint REAL en vivo (HTTP, incluye caché + deploy + red).
 *   4. Verifica que el endpoint refleja ese progreso (no vacío, suma ≈ esperado,
 *      rangos sanos). Una regresión tipo V4 haría suma ≪ esperado → critical.
 */

const BASE_URL = 'https://www.vence.es';
// 10s como los canaries hermanos (answer-save/stats-pipeline): el endpoint añade
// verifyAuth (round-trip extra) y un cold-start de Vercel puede rozar 8s. Un
// timeout NO es "endpoint roto" → el cron lo emite como warn (latencia), no critical.
const HTTP_TIMEOUT_MS = 10_000;
// Suelo: el endpoint (cacheado ≤5min) debe reflejar al menos el 70% del progreso
// en-scope calculado fresco. La V4 devolvía ~3% → se caza sobradamente. El margen
// tolera staleness de caché + respuestas nuevas entre las dos lecturas.
const MIN_RATIO = 0.7;
// Por debajo de este volumen no se afirma nada (el usuario más pesado siempre lo
// supera; es una salvaguarda).
const MIN_EXPECTED = 200;
// El "usuario más pesado" se elige con un full-scan + GROUP BY de TODA
// user_article_stats (~6.7s, 126MB): era el 2º mayor consumidor de BD del sistema
// y, corriendo cada 10min, presionaba endpoints user-facing (saturación-503 en
// oposiciones-compatibles/progress, cuya propia query es rápida pero se colgaba
// bajo esa presión). El usuario más pesado es ESTABLE → lo cacheamos 1h. El
// `expected` se recalcula fresco cada run (barato, per-user) para no dar falsos
// mismatch si el usuario sigue respondiendo.
const PICK_USER_TTL_MS = 60 * 60 * 1000;

/** Pure: ¿el usuario pesado cacheado sigue fresco? (TTL desde su selección). */
export function isPickedUserFresh(
  pickedAt: number | null,
  now: number,
  ttlMs: number = PICK_USER_TTL_MS,
): boolean {
  return pickedAt !== null && now - pickedAt < ttlMs;
}

export interface CanaryThemeStatRow {
  tema_number: number;
  total: number;
  accuracy: number;
  scope_articles: number;
  answered_articles: number;
}

/**
 * Lógica PURA del veredicto (testeable sin red ni BD). Dado el total esperado
 * (en-scope, de BD) y la respuesta del endpoint, decide ok/fallo.
 */
export function evaluateThemeStatsCanary(
  expectedInScopeTotal: number,
  stats: CanaryThemeStatRow[],
): { ok: boolean; reason?: string; endpointSum: number } {
  if (!Array.isArray(stats)) {
    return { ok: false, reason: 'stats no es un array', endpointSum: 0 };
  }
  const endpointSum = stats.reduce((a, s) => a + (Number(s.total) || 0), 0);

  if (expectedInScopeTotal < MIN_EXPECTED) {
    // No hay base suficiente para afirmar (no debería pasar con el user más pesado).
    return { ok: true, reason: 'expected_below_floor', endpointSum };
  }
  if (stats.length === 0) {
    return {
      ok: false,
      reason: `endpoint vacío pese a ${expectedInScopeTotal} respuestas en scope (regresión tipo V4 / caché rota)`,
      endpointSum,
    };
  }
  if (endpointSum < MIN_RATIO * expectedInScopeTotal) {
    return {
      ok: false,
      reason: `endpoint suma ${endpointSum} vs ${expectedInScopeTotal} esperado (<${Math.round(MIN_RATIO * 100)}% → progreso oculto, regresión tipo V4)`,
      endpointSum,
    };
  }
  for (const s of stats) {
    if (s.accuracy < 0 || s.accuracy > 100) {
      return { ok: false, reason: `accuracy fuera de rango en T${s.tema_number}: ${s.accuracy}`, endpointSum };
    }
    if (!(s.scope_articles > 0)) {
      return { ok: false, reason: `scope_articles<=0 en T${s.tema_number} (cobertura rota)`, endpointSum };
    }
    if (s.answered_articles > s.scope_articles) {
      return { ok: false, reason: `answered_articles>scope_articles en T${s.tema_number} (cobertura incoherente)`, endpointSum };
    }
  }
  return { ok: true, endpointSum };
}

@Injectable()
export class CanaryThemeStatsService {
  private readonly logger = new Logger(CanaryThemeStatsService.name);
  // Cache in-memory del usuario más pesado (evita el full-scan de ~6.7s cada run).
  private pickedUser: { userId: string; positionType: string; pickedAt: number } | null = null;

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async run(): Promise<CanaryThemeStatsResult> {
    const startedAt = Date.now();
    try {
      // 1. Usuario más pesado cuyo target es una oposición ACTIVA (con topics).
      //    CACHEADO 1h: el full-scan + GROUP BY de toda user_article_stats cuesta
      //    ~6.7s; recomputarlo cada 10min era el 2º mayor consumidor de BD. El
      //    usuario más pesado es estable, así que solo se re-elige al expirar.
      let userId: string;
      let positionType: string;
      if (isPickedUserFresh(this.pickedUser?.pickedAt ?? null, Date.now())) {
        userId = this.pickedUser!.userId;
        positionType = this.pickedUser!.positionType;
      } else {
        const userRows = (await this.db.execute(sql`
          SELECT uas.user_id::text AS user_id, up.target_oposicion AS position_type
          FROM user_article_stats uas
          INNER JOIN user_profiles up ON up.id = uas.user_id
          WHERE up.target_oposicion IN (
            SELECT DISTINCT position_type FROM topics WHERE is_active = true
          )
          GROUP BY uas.user_id, up.target_oposicion
          ORDER BY COUNT(*) DESC
          LIMIT 1
        `)) as unknown as Array<{ user_id: string; position_type: string }>;

        const picked = userRows?.[0];
        if (!picked) {
          return { skipped: true, reason: 'no_eligible_user', durationMs: Date.now() - startedAt };
        }
        userId = picked.user_id;
        positionType = picked.position_type;
        this.pickedUser = { userId, positionType, pickedAt: Date.now() };
      }

      // 2. Total ESPERADO de respuestas en el scope de su oposición (artículo→topic_scope).
      const expRows = (await this.db.execute(sql`
        WITH per_article AS (
          SELECT uas.article_id, SUM(uas.total_questions) AS total
          FROM user_article_stats uas
          WHERE uas.user_id = ${userId}::uuid AND uas.article_id IS NOT NULL
          GROUP BY uas.article_id
        ),
        scope AS (
          SELECT DISTINCT a.id AS article_id
          FROM topics t
          INNER JOIN topic_scope ts ON ts.topic_id = t.id
          INNER JOIN articles a ON a.law_id = ts.law_id
            AND (ts.article_numbers IS NULL OR a.article_number = ANY(ts.article_numbers))
          WHERE t.position_type = ${positionType}
        )
        SELECT COALESCE(SUM(pa.total), 0)::int AS expected
        FROM per_article pa
        INNER JOIN scope s ON s.article_id = pa.article_id
      `)) as unknown as Array<{ expected: number }>;

      const expected = Number(expRows?.[0]?.expected ?? 0);
      if (expected < MIN_EXPECTED) {
        // El usuario cacheado ya no califica (borrado / cambió de oposición) →
        // invalidar para re-elegir en el próximo run en vez de quedarnos pegados.
        this.pickedUser = null;
        return { skipped: true, reason: 'expected_below_floor', durationMs: Date.now() - startedAt };
      }

      // 3. Endpoint REAL en vivo (incluye caché, deploy, red).
      // El endpoint usa el user del TOKEN (ignora ?userId=), así que firmamos
      // PARA el usuario pesado seleccionado → el endpoint computa SUS stats.
      // (Tras la migración C1 el endpoint exige verifyAuth; sin token = 401.)
      const token = signCanaryToken(userId);
      if (!token) {
        return { skipped: true, reason: 'jwt_secret_not_configured', durationMs: Date.now() - startedAt };
      }
      const slug = positionType.replace(/_/g, '-');
      const url = `${BASE_URL}/api/v2/topic-progress/theme-stats?userId=${userId}&oposicionId=${slug}`;
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
      let json: { success?: boolean; stats?: CanaryThemeStatRow[] };
      try {
        const resp = await fetch(url, {
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${token}`,
            'User-Agent': 'Vence-Canary-ThemeStats/1.0',
            'x-vence-canary': '1',
          },
        });
        if (!resp.ok) {
          return {
            ok: false, step: 'http', positionType, expected,
            errorMessage: `HTTP ${resp.status} del endpoint theme-stats`,
            durationMs: Date.now() - startedAt,
          };
        }
        json = await resp.json();
      } finally {
        clearTimeout(t);
      }

      if (!json?.success || !Array.isArray(json.stats)) {
        return {
          ok: false, step: 'response', positionType, expected,
          errorMessage: `respuesta inesperada: ${JSON.stringify(json).slice(0, 120)}`,
          durationMs: Date.now() - startedAt,
        };
      }

      // 4. Veredicto.
      const verdict = evaluateThemeStatsCanary(expected, json.stats);
      if (!verdict.ok) {
        return {
          ok: false, step: 'semantic', positionType, expected,
          endpointSum: verdict.endpointSum,
          errorMessage: verdict.reason ?? 'veredicto negativo',
          durationMs: Date.now() - startedAt,
        };
      }
      return {
        ok: true, positionType, expected, endpointSum: verdict.endpointSum,
        durationMs: Date.now() - startedAt,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false, step: /abort|timeout/i.test(msg) ? 'timeout' : 'query',
        errorMessage: msg, durationMs: Date.now() - startedAt,
      };
    }
  }
}

export type CanaryThemeStatsResult =
  | { skipped: true; reason: string; durationMs: number }
  | { ok: true; positionType: string; expected: number; endpointSum: number; durationMs: number }
  | {
      ok: false;
      step: 'http' | 'response' | 'semantic' | 'timeout' | 'query';
      positionType?: string;
      expected?: number;
      endpointSum?: number;
      errorMessage: string;
      durationMs: number;
    };

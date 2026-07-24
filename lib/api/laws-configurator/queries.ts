// lib/api/laws-configurator/queries.ts - Queries para configurador de leyes
import { getDb, getPoolerDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import { unstable_cache } from 'next/cache'
import { withDbTimeout } from '@/lib/db/timeout'
import { emitFireAndForget } from '@/lib/observability/emit'
import type { GetAllLawsResponse } from './schemas'
import { buildLawsResponse, type LawStatRow } from './transform'

function getLawsConfDb() {
  return process.env.USE_SELF_HOSTED_POOLER === 'true' ? getPoolerDb() : getDb()
}

// Quick-fail: antes la query podía tardar 30s y devolver un 500 opaco en
// /test/por-leyes (bug David/Galicia 24/07). Con el timeout falla rápido (y emite
// http_timeout) en vez de colgar; el caché sirve el último valor bueno.
const CONF_TIMEOUT_MS = Number(process.env.LAWS_CONF_TIMEOUT_MS) || 8000

/**
 * Cómputo REAL (miss de caché). LANZA si la BD falla/timeouta a propósito: así
 * `unstable_cache` NO cachea una respuesta de error (que se serviría 1h). El
 * caller lo captura y devuelve {success:false} SIN cachear.
 */
async function computeLawsStats(positionType: string | null): Promise<GetAllLawsResponse> {
  const started = Date.now()
  const source: 'scoped' | 'all' = positionType ? 'scoped' : 'all'
  const db = getLawsConfDb()

  // 🎯 Acotado a oposición: se materializa el set de artículos escopados UNA vez
  // (CTE) y se une, en vez del `EXISTS` correlado + `article_number = ANY(...)` por
  // fila sobre TODAS las preguntas (plan que degeneraba a 30s). Mantiene
  // count(DISTINCT) → conteos EXACTOS (verificado paridad 0-diffs vs la query vieja
  // en scripts/scope/sim-laws-configurator.cjs). NO se usa la summary pre-agregada
  // porque su SUM entre temas sobre-contaba 2-3x las preguntas compartidas.
  const query = positionType
    ? sql`
        WITH scoped AS (
          SELECT DISTINCT a.id, a.law_id
          FROM articles a
          JOIN topic_scope ts ON ts.law_id = a.law_id
          JOIN topics t ON t.id = ts.topic_id
          WHERE t.position_type = ${String(positionType).slice(0, 120)}
            AND (ts.article_numbers IS NULL OR a.article_number = ANY(ts.article_numbers))
        )
        SELECT laws.short_name AS "lawShortName", laws.name AS "lawName",
               count(DISTINCT q.id)::int AS "totalQuestions",
               count(DISTINCT s.id)::int AS "articlesWithQuestions"
        FROM questions q
        JOIN scoped s ON s.id = q.primary_article_id
        JOIN laws ON s.law_id = laws.id
        WHERE q.is_active AND laws.is_active AND laws.short_name IS NOT NULL
        GROUP BY laws.short_name, laws.name`
    : sql`
        SELECT laws.short_name AS "lawShortName", laws.name AS "lawName",
               count(DISTINCT q.id)::int AS "totalQuestions",
               count(DISTINCT a.id)::int AS "articlesWithQuestions"
        FROM questions q
        JOIN articles a ON q.primary_article_id = a.id
        JOIN laws ON a.law_id = laws.id
        WHERE q.is_active AND laws.is_active AND laws.short_name IS NOT NULL
        GROUP BY laws.short_name, laws.name`

  const rows = (await withDbTimeout(() => db.execute(query), CONF_TIMEOUT_MS)) as unknown as LawStatRow[]
  const out = buildLawsResponse(rows)
  const durationMs = Date.now() - started

  // 🔭 Observabilidad SIEMPRE (en el cómputo real): fuente + timing + tamaño. Vigila
  // que NO vuelva a acercarse al timeout; warn > 3s (síntoma precoz del plan lento).
  emitFireAndForget({
    source: 'fargate',
    severity: durationMs > 3000 ? 'warn' : 'info',
    eventType: 'laws_configurator_stats',
    endpoint: '/api/laws-configurator',
    metadata: { source, positionType: positionType ?? null, laws: out.totalLaws, totalQuestions: out.totalQuestions, durationMs },
  })

  // 🔭 Anti-callejón: acotado pero 0 leyes → "Sin leyes disponibles" para el usuario.
  if (positionType && out.totalLaws === 0) {
    emitFireAndForget({
      source: 'fargate', severity: 'warn', eventType: 'laws_configurator_empty_scope',
      endpoint: '/api/laws-configurator', metadata: { positionType },
    })
  }
  return out
}

// ============================================
// OBTENER TODAS LAS LEYES CON ESTADÍSTICAS
// ============================================

export async function getAllLawsWithStats(positionType?: string | null): Promise<GetAllLawsResponse> {
  const pt = positionType ?? null
  // 🚀 Caché por oposición: el dato del configurador cambia despacio (preguntas/
  // scope). Se invalida con el tag 'test-counts' (mismo que ya se revalida al tocar
  // topic_scope). Tras el 1er cómputo → instantáneo; un refresh lento no bloquea al
  // usuario. Solo se cachea el ÉXITO: computeLawsStats LANZA en error, así el caché
  // no envenena 1h con un fallo transitorio.
  const cached = unstable_cache(
    () => computeLawsStats(pt),
    ['laws-configurator-v2', pt ?? '__all__'],
    { tags: ['test-counts'], revalidate: 3600 },
  )
  try {
    return await cached()
  } catch (error) {
    emitFireAndForget({
      source: 'fargate', severity: 'error', eventType: 'laws_configurator_error',
      endpoint: '/api/laws-configurator',
      metadata: { positionType: pt, error: error instanceof Error ? error.message.slice(0, 200) : 'unknown' },
    })
    console.error('❌ [LawsConfigurator] Error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}

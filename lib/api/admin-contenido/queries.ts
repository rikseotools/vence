// lib/api/admin-contenido/queries.ts
//
// Dashboard "Contenido": estado de completitud por oposición. Para cada
// oposición activa mira sus temas (topics.position_type = replace(slug,'-','_'))
// y cuenta las preguntas que le atribuye la materialized view
// topic_law_question_summary (lo que ve el usuario en el hub de tests):
//   - en_desarrollo: tema disponible con 0 preguntas (sale "En desarrollo")
//   - finos: tema disponible con pocas preguntas (1..FINO_MAX-1)
//   - ok: tema disponible con >= FINO_MAX preguntas
// SQL crudo vía getDb().execute (mismo patrón que competitors/radar-contenido).

import { getDb } from '@/db/client'
import { sql } from 'drizzle-orm'

export { epigrafeBadge, EPIGRAFE_TONE_CLS } from './epigrafeBadge'
export type { EpigrafeTone, EpigrafeCounts } from './epigrafeBadge'
export { coverageBadge, COVERAGE_TONE_CLS } from './coverageBadge'
export type { CoverageTone, CoverageCounts } from './coverageBadge'

function rows<T>(res: unknown): T[] {
  return res as unknown as T[]
}

// Umbral: por debajo de esto un tema se considera "fino" (pocas preguntas).
export const FINO_MAX = 20

/**
 * Vendibilidad = eje ORTOGONAL al de contenido. Derivado (no a mano) de la
 * oportunidad viva (OEP × cuerpo) resuelta en oposiciones_ssot. Hoy vendemos
 * solo ingreso LIBRE → mira plazas_libres. "null nunca mudo": plazas_libres
 * NULL = desconocido (nunca verificado), NO se colapsa a "no vendible".
 *   - vendible:      plazas_libres > 0 y examen no pasado (exam_date nula/futura)
 *   - no_vendible:   examen pasado, o plazas_libres = 0
 *   - sin_verificar: plazas_libres NULL
 */
export type Vendibilidad = 'vendible' | 'no_vendible' | 'sin_verificar'

export interface ContenidoRow {
  slug: string
  nombre: string | null
  short_name: string | null
  disponibles: number
  en_desarrollo: number
  finos: number
  ok: number
  total_preguntas: number
  usuarios: number
  premium: number
  vendibilidad: Vendibilidad
  plazas_libres: number | null
  exam_date: string | null
  // Epígrafe (Sistema 2): literalidad del epígrafe de BD vs el temario oficial
  // de la convocatoria. Agregado por oposición desde la vista
  // topic_epigrafe_verification_effective (cubre TODOS los temas activos; los no
  // verificados salen never_sourced). Denominador = epi_topics (temas activos).
  epi_topics: number
  epi_literal: number
  epi_drift: number
  epi_provisional: number
  epi_stale: number
  epi_never: number
  // Cobertura de artículos: artículos que están en el topic_scope con contenido
  // real (no derogados/vacíos) pero 0 preguntas activas → al usuario nunca le
  // salen en tests aunque el tema en conjunto sí tenga preguntas (caso M/SMS
  // Tema 7). arts_sin_preguntas = total de esos artículos; temas_sin_cobertura =
  // en cuántos temas distintos aparecen.
  arts_sin_preguntas: number
  temas_sin_cobertura: number
}


export interface ContenidoOverview {
  success: true
  oposiciones: ContenidoRow[]
  summary: {
    total: number
    conEnDesarrollo: number
    conFinos: number
    completas: number
  }
}

export async function getContenidoOverview(): Promise<ContenidoOverview> {
  const db = getDb()
  const res = await db.execute(sql`
    WITH tema_counts AS (
      SELECT
        o.slug, o.nombre, o.short_name, t.disponible,
        COALESCE(
          (SELECT sum(mv.total_questions) FROM topic_law_question_summary mv WHERE mv.topic_id = t.id),
          0
        )::int AS q
      FROM oposiciones o
      JOIN topics t
        ON t.position_type = replace(o.slug, '-', '_') AND t.is_active = true
      WHERE o.is_active = true
    ),
    user_counts AS (
      SELECT
        up.target_oposicion AS pt,
        count(*)::int                                          AS usuarios,
        count(*) FILTER (WHERE up.plan_type = 'premium')::int  AS premium
      FROM user_profiles up
      WHERE up.target_oposicion IS NOT NULL
      GROUP BY up.target_oposicion
    ),
    -- Vendibilidad: campos temporales resueltos desde la convocatoria vigente.
    vend AS (
      SELECT slug, plazas_libres, exam_date FROM oposiciones_ssot
    ),
    -- Epígrafe (S2): agrega el estado efectivo por oposición. La vista cubre
    -- TODOS los temas activos (los no verificados = never_sourced).
    epi AS (
      SELECT
        ev.position_type AS pt,
        count(*)::int                                                       AS epi_topics,
        count(*) FILTER (WHERE ev.effective_state = 'verified_literal')::int      AS epi_literal,
        count(*) FILTER (WHERE ev.effective_state = 'drift_detected')::int        AS epi_drift,
        count(*) FILTER (WHERE ev.effective_state = 'provisional_anterior')::int  AS epi_provisional,
        count(*) FILTER (WHERE ev.effective_state = 'stale')::int                 AS epi_stale,
        count(*) FILTER (WHERE ev.effective_state = 'never_sourced')::int         AS epi_never
      FROM topic_epigrafe_verification_effective ev
      GROUP BY ev.position_type
    ),
    -- Cobertura de artículos (hueco OCULTO tipo M/SMS Tema 7): artículos en scope
    -- con contenido real pero 0 preguntas, PERO solo en temas que están MAYORMENTE
    -- cubiertos a nivel de artículo (≥60%) — el patrón "casi terminado, faltan un
    -- puñado". NO cuenta oposiciones poco desarrolladas (scope de leyes enteras con
    -- cobertura dispersa) — eso ya lo señalan las columnas 🔴/🟡. Excluye derogados.
    cov AS (
      SELECT pt, sum(n_content - n_cov)::int AS arts_sin_preguntas, count(*)::int AS temas_sin_cobertura
      FROM (
        SELECT tp.position_type AS pt, tp.id AS tid,
               count(*)::int AS n_content,
               count(*) FILTER (WHERE EXISTS (
                 SELECT 1 FROM questions q WHERE q.primary_article_id = a.id AND q.is_active))::int AS n_cov
        FROM topic_scope ts
        JOIN topics tp ON tp.id = ts.topic_id AND tp.is_active
        JOIN LATERAL unnest(ts.article_numbers) AS an(num) ON true
        JOIN articles a ON a.law_id = ts.law_id AND a.article_number = an.num
        WHERE length(coalesce(a.content, '')) > 40 AND a.content NOT ILIKE '%derogado%'
          AND a.article_number ~ '^[0-9]+$'
        GROUP BY tp.position_type, tp.id
      ) ta
      WHERE n_content >= 4 AND n_cov < n_content AND n_cov::float / n_content >= 0.6
      GROUP BY pt
    )
    SELECT
      tc.slug, tc.nombre, tc.short_name,
      count(*) FILTER (WHERE tc.disponible)::int                                 AS disponibles,
      count(*) FILTER (WHERE tc.disponible AND tc.q = 0)::int                    AS en_desarrollo,
      count(*) FILTER (WHERE tc.disponible AND tc.q BETWEEN 1 AND ${FINO_MAX - 1})::int AS finos,
      count(*) FILTER (WHERE tc.disponible AND tc.q >= ${FINO_MAX})::int         AS ok,
      COALESCE(sum(tc.q) FILTER (WHERE tc.disponible), 0)::int                   AS total_preguntas,
      COALESCE(max(uc.usuarios), 0)::int                                         AS usuarios,
      COALESCE(max(uc.premium), 0)::int                                          AS premium,
      max(v.plazas_libres)::int                                                  AS plazas_libres,
      max(v.exam_date)::text                                                     AS exam_date,
      COALESCE(max(e.epi_topics), 0)::int                                        AS epi_topics,
      COALESCE(max(e.epi_literal), 0)::int                                       AS epi_literal,
      COALESCE(max(e.epi_drift), 0)::int                                         AS epi_drift,
      COALESCE(max(e.epi_provisional), 0)::int                                   AS epi_provisional,
      COALESCE(max(e.epi_stale), 0)::int                                         AS epi_stale,
      COALESCE(max(e.epi_never), 0)::int                                         AS epi_never,
      COALESCE(max(cv.arts_sin_preguntas), 0)::int                               AS arts_sin_preguntas,
      COALESCE(max(cv.temas_sin_cobertura), 0)::int                              AS temas_sin_cobertura,
      CASE
        WHEN max(v.plazas_libres) IS NULL THEN 'sin_verificar'
        WHEN max(v.plazas_libres) > 0
             AND (max(v.exam_date) IS NULL OR max(v.exam_date) >= CURRENT_DATE) THEN 'vendible'
        ELSE 'no_vendible'
      END                                                                        AS vendibilidad
    FROM tema_counts tc
    LEFT JOIN user_counts uc ON uc.pt = replace(tc.slug, '-', '_')
    LEFT JOIN vend v ON v.slug = tc.slug
    LEFT JOIN epi e ON e.pt = replace(tc.slug, '-', '_')
    LEFT JOIN cov cv ON cv.pt = replace(tc.slug, '-', '_')
    GROUP BY tc.slug, tc.nombre, tc.short_name
    HAVING count(*) FILTER (WHERE tc.disponible) > 0
    ORDER BY usuarios DESC, en_desarrollo DESC, finos DESC
  `)
  const oposiciones = rows<ContenidoRow>(res)
  return {
    success: true,
    oposiciones,
    summary: {
      total: oposiciones.length,
      conEnDesarrollo: oposiciones.filter((o) => o.en_desarrollo > 0).length,
      conFinos: oposiciones.filter((o) => o.finos > 0).length,
      completas: oposiciones.filter((o) => o.en_desarrollo === 0 && o.finos === 0).length,
    },
  }
}

export interface ContenidoCount {
  success: true
  count: number
}

/** Badge del nav: oposiciones con temas "En desarrollo" (0 preguntas) = urgente. */
export async function getContenidoCount(): Promise<ContenidoCount> {
  const { oposiciones } = await getContenidoOverview()
  return { success: true, count: oposiciones.filter((o) => o.en_desarrollo > 0).length }
}

// ─────────────────────────────────────────────────────────────────────────────
// Drill-down de epígrafe (S2): detalle tema a tema de una oposición para el
// modal de /admin/contenido. Muestra el epígrafe de BD + su estado efectivo +
// hallazgos + cuándo/contra qué convocatoria se verificó.

export interface EpigrafeDetailRow {
  topic_number: number
  title: string | null
  epigrafe: string | null
  effective_state: string
  note: string | null
  verified_at: string | null
  // Provenance de la fuente exacta del epígrafe (Paso 1 / clonación) — para
  // re-verificación directa. source_url = URL oficial; source_notes = comentario.
  source_url: string | null
  source_notes: string | null
}

export interface EpigrafeDetail {
  success: true
  slug: string
  temas: EpigrafeDetailRow[]
}

export async function getEpigrafeDetail(slug: string): Promise<EpigrafeDetail> {
  const db = getDb()
  const pt = slug.replace(/-/g, '_')
  const res = await db.execute(sql`
    SELECT
      t.topic_number,
      t.title,
      t.epigrafe,
      ev.effective_state,
      b.findings->>'note'        AS note,
      b.verified_at::text        AS verified_at,
      b.source_url               AS source_url,
      b.source_notes             AS source_notes
    FROM topics t
    JOIN topic_epigrafe_verification_effective ev ON ev.topic_id = t.id
    LEFT JOIN topic_epigrafe_verification b ON b.topic_id = t.id
    WHERE t.position_type = ${pt} AND t.is_active = true
    ORDER BY t.topic_number
  `)
  return { success: true, slug, temas: rows<EpigrafeDetailRow>(res) }
}

// ─────────────────────────────────────────────────────────────────────────────
// Drill-down de cobertura de artículos: qué artículos concretos están en el
// scope con contenido pero 0 preguntas (por tema), para el modal de /admin/contenido.

export interface CoverageDetailRow {
  topic_number: number
  title: string | null
  ley: string
  article_number: string
  preview: string | null
}

export interface CoverageDetail {
  success: true
  slug: string
  articulos: CoverageDetailRow[]
}

export async function getArticleCoverageDetail(slug: string): Promise<CoverageDetail> {
  const db = getDb()
  const pt = slug.replace(/-/g, '_')
  const res = await db.execute(sql`
    WITH qual AS (
      -- temas mayormente cubiertos a nivel de artículo (≥60%) con huecos: mismo
      -- criterio que la CTE cov de la columna.
      SELECT tp.id AS tid
      FROM topic_scope ts
      JOIN topics tp ON tp.id = ts.topic_id AND tp.is_active
      JOIN LATERAL unnest(ts.article_numbers) AS an(num) ON true
      JOIN articles a ON a.law_id = ts.law_id AND a.article_number = an.num
      WHERE tp.position_type = ${pt}
        AND length(coalesce(a.content, '')) > 40 AND a.content NOT ILIKE '%derogado%'
        AND a.article_number ~ '^[0-9]+$'
      GROUP BY tp.id
      HAVING count(*) >= 4
         AND count(*) FILTER (WHERE EXISTS (SELECT 1 FROM questions q WHERE q.primary_article_id = a.id AND q.is_active)) < count(*)
         AND count(*) FILTER (WHERE EXISTS (SELECT 1 FROM questions q WHERE q.primary_article_id = a.id AND q.is_active))::float / count(*) >= 0.6
    )
    SELECT
      tp.topic_number,
      tp.title,
      l.short_name                       AS ley,
      a.article_number,
      left(regexp_replace(a.content, '\\s+', ' ', 'g'), 90) AS preview
    FROM topic_scope ts
    JOIN topics tp ON tp.id = ts.topic_id AND tp.is_active AND tp.id IN (SELECT tid FROM qual)
    JOIN laws l ON l.id = ts.law_id
    JOIN LATERAL unnest(ts.article_numbers) AS an(num) ON true
    JOIN articles a ON a.law_id = ts.law_id AND a.article_number = an.num
    WHERE length(coalesce(a.content, '')) > 40
      AND a.content NOT ILIKE '%derogado%'
      AND a.article_number ~ '^[0-9]+$'
      AND NOT EXISTS (SELECT 1 FROM questions q WHERE q.primary_article_id = a.id AND q.is_active)
    ORDER BY tp.topic_number, (a.article_number)::int
  `)
  return { success: true, slug, articulos: rows<CoverageDetailRow>(res) }
}

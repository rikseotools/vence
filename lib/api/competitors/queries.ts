// lib/api/competitors/queries.ts
//
// Queries del panel admin de competidores. Tablas competitor_* sin modelo
// Drizzle todavía → SQL crudo vía getDb().execute (mismo patrón que
// discovered_processes en oep-signals). Fuente: subsistema backend/src/competitors.
// Diseño: docs/roadmap/analizador-competidores.md

import { getDb } from '@/db/client'
import { sql } from 'drizzle-orm'

function rows<T>(res: unknown): T[] {
  return res as unknown as T[]
}

export interface CompetitorChangesCount {
  success: true
  changesCount: number
}

// Tipos de cambio ACCIONABLES (movimiento comercial). Excluye url_added y
// url_modified: son ruido de contenido/hash (miles en backfill, refrescos de
// plantilla). Un precio o curso nuevo emite su propio tipo, así que no se pierde.
const BADGE_CHANGE_TYPES = ['course_added', 'course_removed', 'price_changed', 'url_removed'] as const

/** Contador del badge: señales accionables SIN revisar de los últimos 7 días. */
export async function getCompetitorChangesCount(): Promise<CompetitorChangesCount> {
  const db = getDb()
  const res = await db.execute(sql`
    SELECT count(*)::int AS count
    FROM competitor_changes
    WHERE reviewed_at IS NULL
      AND detected_at > now() - interval '7 days'
      AND change_type IN (${sql.join(BADGE_CHANGE_TYPES.map((t) => sql`${t}`), sql`, `)})
  `)
  return { success: true, changesCount: Number(rows<{ count: number }>(res)[0]?.count ?? 0) }
}

export interface CompetitorOverviewRow {
  id: string
  slug: string
  name: string
  tipo: string | null
  region: string | null
  tech: Record<string, unknown> | null
  last_synced_at: string | null
  urls: number
  courses: number
  matched: number
  gaps: number
}

export interface CompetitorChangeRow {
  id: string
  change_type: string
  url: string | null
  detail: Record<string, unknown> | null
  detected_at: string
  reviewed_at: string | null
  competitor: string
}

/**
 * Pivote por OPOSICIÓN — el nexo común con el radar de señales: para cada
 * oposición nuestra, qué competidores la preparan y a qué precio. La misma
 * `oposicion_id` que usa `oep_detection_signals` para las señales.
 */
export interface OposicionCompetitorsRow {
  oposicion_id: string
  nombre: string
  slug: string | null
  n_competidores: number
  competidores: string[]
  cuota_min: number | null
  cuota_max: number | null
}

export interface CompetitorsOverview {
  success: true
  totals: {
    competitors: number
    courses: number
    urls: number
    gaps: number
    needs_review: number
    recent_changes: number
  }
  oposiciones: OposicionCompetitorsRow[]
  competitors: CompetitorOverviewRow[]
  changes: CompetitorChangeRow[]
}

/** Datos del panel: totales + competidores con conteos + feed de cambios recientes. */
export async function getCompetitorsOverview(): Promise<CompetitorsOverview> {
  const db = getDb()
  const [totalsRes, oposicionesRes, competitorsRes, changesRes] = await Promise.all([
    db.execute(sql`
      SELECT
        (SELECT count(*)::int FROM competitors WHERE is_active) AS competitors,
        (SELECT count(*)::int FROM competitor_courses WHERE is_active) AS courses,
        (SELECT count(*)::int FROM competitor_urls WHERE is_active) AS urls,
        (SELECT count(*)::int FROM competitor_courses WHERE is_active AND oposicion_id IS NULL) AS gaps,
        (SELECT count(*)::int FROM competitor_courses WHERE is_active AND match_method = 'needs_review') AS needs_review,
        (SELECT count(*)::int FROM competitor_changes
           WHERE reviewed_at IS NULL AND detected_at > now() - interval '7 days'
             AND change_type IN (${sql.join(BADGE_CHANGE_TYPES.map((t) => sql`${t}`), sql`, `)})) AS recent_changes
    `),
    // Pivote por oposición: quién prepara cada oposición nuestra + rango de cuota.
    db.execute(sql`
      SELECT o.id AS oposicion_id, o.nombre, o.slug,
        count(DISTINCT cc.competitor_id)::int AS n_competidores,
        array_agg(DISTINCT c.name) AS competidores,
        min(cp.amount_cents) FILTER (WHERE cp.price_kind='cuota' AND cp.period='mensual') AS cuota_min,
        max(cp.amount_cents) FILTER (WHERE cp.price_kind='cuota' AND cp.period='mensual') AS cuota_max
      FROM competitor_courses cc
      JOIN competitors c ON c.id = cc.competitor_id
      JOIN oposiciones o ON o.id = cc.oposicion_id
      LEFT JOIN competitor_prices cp ON cp.competitor_course_id = cc.id AND cp.is_current
      WHERE cc.is_active
      GROUP BY o.id, o.nombre, o.slug
      ORDER BY n_competidores DESC, o.nombre
    `),
    db.execute(sql`
      SELECT c.id, c.slug, c.name, c.tipo, c.region, c.tech, c.last_synced_at,
        (SELECT count(*)::int FROM competitor_urls u WHERE u.competitor_id = c.id AND u.is_active) AS urls,
        (SELECT count(*)::int FROM competitor_courses cc WHERE cc.competitor_id = c.id AND cc.is_active) AS courses,
        (SELECT count(*)::int FROM competitor_courses cc WHERE cc.competitor_id = c.id AND cc.is_active AND cc.oposicion_id IS NOT NULL) AS matched,
        (SELECT count(*)::int FROM competitor_courses cc WHERE cc.competitor_id = c.id AND cc.is_active AND cc.oposicion_id IS NULL) AS gaps
      FROM competitors c
      ORDER BY c.name
    `),
    db.execute(sql`
      SELECT ch.id, ch.change_type, ch.url, ch.detail, ch.detected_at, ch.reviewed_at, c.name AS competitor
      FROM competitor_changes ch
      JOIN competitors c ON c.id = ch.competitor_id
      ORDER BY (ch.reviewed_at IS NULL) DESC, ch.detected_at DESC
      LIMIT 100
    `),
  ])

  const totals = rows<CompetitorsOverview['totals']>(totalsRes)[0] ?? {
    competitors: 0, courses: 0, urls: 0, gaps: 0, needs_review: 0, recent_changes: 0,
  }
  return {
    success: true,
    totals,
    oposiciones: rows<OposicionCompetitorsRow>(oposicionesRes),
    competitors: rows<CompetitorOverviewRow>(competitorsRes),
    changes: rows<CompetitorChangeRow>(changesRes),
  }
}

// ============================================
// DETALLE POR OPOSICIÓN: quién la prepara y a qué COSTE cada uno
// ============================================

export interface CompetitorPriceLine {
  kind: string
  audience: string | null
  amount_cents: number | null
  period: string | null
  plan: string | null
  includes: string[]
}

export interface CompetitorForOposicionRow {
  competitor_id: string
  competitor: string
  tipo: string | null
  region: string | null
  modalidad: string | null
  course_url: string | null
  raw_name: string
  prices: CompetitorPriceLine[]
}

export interface OposicionCompetitorsDetail {
  success: true
  oposicion: { id: string; nombre: string; slug: string | null } | null
  competitors: CompetitorForOposicionRow[]
}

/**
 * Para una oposición dada: cada competidor que la prepara + su desglose de
 * precios (matrícula/cuota/intensivo/tasa) vigente. Robusto: agrega los precios
 * en la BD (jsonb) → una fila por competidor con su coste completo.
 */
export async function getCompetitorsForOposicion(
  oposicionId: string,
): Promise<OposicionCompetitorsDetail> {
  const db = getDb()
  const [opoRes, compRes] = await Promise.all([
    db.execute(sql`SELECT id, nombre, slug FROM oposiciones WHERE id = ${oposicionId} LIMIT 1`),
    db.execute(sql`
      SELECT c.id AS competitor_id, c.name AS competitor, c.tipo, c.region,
        cc.modalidad, cc.raw_name, u.url AS course_url,
        COALESCE(
          json_agg(
            json_build_object('kind', cp.price_kind, 'audience', cp.audience,
                              'amount_cents', cp.amount_cents, 'period', cp.period,
                              'plan', cp.plan, 'includes', cp.includes)
            ORDER BY cp.plan NULLS FIRST, cp.price_kind
          ) FILTER (WHERE cp.id IS NOT NULL), '[]'
        ) AS prices
      FROM competitor_courses cc
      JOIN competitors c ON c.id = cc.competitor_id
      LEFT JOIN competitor_urls u ON u.id = cc.competitor_url_id
      LEFT JOIN competitor_prices cp ON cp.competitor_course_id = cc.id AND cp.is_current AND cp.amount_cents > 0
      WHERE cc.oposicion_id = ${oposicionId} AND cc.is_active
      GROUP BY c.id, c.name, c.tipo, c.region, cc.modalidad, cc.raw_name, u.url
      ORDER BY c.name
    `),
  ])
  return {
    success: true,
    oposicion: rows<{ id: string; nombre: string; slug: string | null }>(opoRes)[0] ?? null,
    competitors: rows<CompetitorForOposicionRow>(compRes),
  }
}

// ============================================
// COLA DE REVISIÓN: matches dudosos que un humano confirma con 1 clic
// ============================================

export interface ReviewQueueRow {
  course_id: string
  competitor: string
  raw_name: string
  course_url: string | null
  ambito: string | null
  region_slug: string | null
  confidence: number | null
  candidate_id: string | null
  candidate_nombre: string | null
  candidate_slug: string | null
}

export interface ReviewQueue {
  success: true
  items: ReviewQueueRow[]
}

/**
 * Cursos en `needs_review`: el matcher tiene una mejor apuesta (candidato) pero no
 * la confianza suficiente para auto-enlazar (ambigüedad o falta de identidad). Un
 * humano confirma o descarta. Orden: mayor confianza primero.
 */
export async function getCompetitorReviewQueue(): Promise<ReviewQueue> {
  const db = getDb()
  const res = await db.execute(sql`
    SELECT cc.id AS course_id, c.name AS competitor, cc.raw_name,
      u.url AS course_url, cc.ambito, cc.region_slug, cc.match_confidence AS confidence,
      cc.match_candidate_id AS candidate_id, o.nombre AS candidate_nombre, o.slug AS candidate_slug
    FROM competitor_courses cc
    JOIN competitors c ON c.id = cc.competitor_id
    LEFT JOIN competitor_urls u ON u.id = cc.competitor_url_id
    LEFT JOIN oposiciones o ON o.id = cc.match_candidate_id
    WHERE cc.is_active AND cc.match_method = 'needs_review'
    ORDER BY cc.match_confidence DESC NULLS LAST, c.name
    LIMIT 300
  `)
  return { success: true, items: rows<ReviewQueueRow>(res) }
}

/**
 * Confirma (o corrige/descarta) manualmente el enlace curso→oposición. Queda STICKY:
 * el re-match automático nunca lo pisa. `oposicionId=null` → descartar (gap manual).
 */
export async function confirmCompetitorMatch(courseId: string, oposicionId: string | null): Promise<void> {
  const db = getDb()
  await db.execute(sql`
    UPDATE competitor_courses
    SET oposicion_id = ${oposicionId},
        match_method = ${oposicionId ? 'confirmed' : 'manual'},
        match_candidate_id = NULL,
        matched_at = now(),
        updated_at = now()
    WHERE id = ${courseId}
  `)
}

// ============================================
// BÚSQUEDA GLOBAL: todas las catalogadas (con o sin competidor) + cursos-gap
// ============================================

export interface CatalogSearchResult {
  success: true
  oposiciones: {
    oposicion_id: string; nombre: string; slug: string | null
    coverage_level: string | null; n_competidores: number
  }[]
  gaps: {
    course_id: string; competitor: string; raw_name: string
    course_url: string | null; ambito: string | null
  }[]
}

/**
 * Búsqueda que NO deja gaps: matchea (insensible a acentos vía unaccent) TODAS las
 * oposiciones catalogadas —tengan o no competidor— y además los cursos de
 * competidores SIN catalogar (oposicion_id NULL), para que nada quede oculto. La
 * usa el buscador del panel cuando hay término; sin término se muestra la lista
 * corta de oposiciones-con-competidor.
 */
export async function searchCatalogAndGaps(q: string): Promise<CatalogSearchResult> {
  const db = getDb()
  const term = `%${q}%`
  const [opoRes, gapRes] = await Promise.all([
    db.execute(sql`
      SELECT o.id AS oposicion_id, o.nombre, o.slug, o.coverage_level,
        (SELECT count(DISTINCT cc.competitor_id)::int
           FROM competitor_courses cc WHERE cc.oposicion_id = o.id AND cc.is_active) AS n_competidores
      FROM oposiciones o
      WHERE unaccent(lower(o.nombre)) LIKE unaccent(lower(${term}))
      ORDER BY n_competidores DESC, o.nombre
      LIMIT 100
    `),
    db.execute(sql`
      SELECT cc.id AS course_id, c.name AS competitor, cc.raw_name,
        u.url AS course_url, cc.ambito
      FROM competitor_courses cc
      JOIN competitors c ON c.id = cc.competitor_id
      LEFT JOIN competitor_urls u ON u.id = cc.competitor_url_id
      WHERE cc.is_active AND cc.oposicion_id IS NULL
        AND unaccent(lower(cc.raw_name)) LIKE unaccent(lower(${term}))
      ORDER BY c.name, cc.raw_name
      LIMIT 100
    `),
  ])
  return {
    success: true,
    oposiciones: rows<CatalogSearchResult['oposiciones'][number]>(opoRes),
    gaps: rows<CatalogSearchResult['gaps'][number]>(gapRes),
  }
}

// ============================================
// TRIAJE de señales: marcar revisadas (conserva histórico, saca del badge)
// ============================================

/**
 * Marca señales como revisadas (`reviewed_at`). `id` marca una; sin `id` marca TODAS
 * las accionables sin revisar (bulk). No borra: la fila queda en el log para auditoría.
 */
export async function acknowledgeCompetitorChanges(id?: string): Promise<number> {
  const db = getDb()
  if (id) {
    await db.execute(sql`UPDATE competitor_changes SET reviewed_at = now() WHERE id = ${id} AND reviewed_at IS NULL`)
    return 1
  }
  const res = await db.execute(sql`
    UPDATE competitor_changes SET reviewed_at = now()
    WHERE reviewed_at IS NULL
      AND change_type IN (${sql.join(BADGE_CHANGE_TYPES.map((t) => sql`${t}`), sql`, `)})
  `)
  return (res as unknown as { rowCount?: number }).rowCount ?? 0
}

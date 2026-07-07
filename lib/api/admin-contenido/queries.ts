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

function rows<T>(res: unknown): T[] {
  return res as unknown as T[]
}

// Umbral: por debajo de esto un tema se considera "fino" (pocas preguntas).
export const FINO_MAX = 20

export interface ContenidoRow {
  slug: string
  nombre: string | null
  short_name: string | null
  disponibles: number
  en_desarrollo: number
  finos: number
  ok: number
  total_preguntas: number
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
    )
    SELECT
      slug, nombre, short_name,
      count(*) FILTER (WHERE disponible)::int                                AS disponibles,
      count(*) FILTER (WHERE disponible AND q = 0)::int                      AS en_desarrollo,
      count(*) FILTER (WHERE disponible AND q BETWEEN 1 AND ${FINO_MAX - 1})::int AS finos,
      count(*) FILTER (WHERE disponible AND q >= ${FINO_MAX})::int           AS ok,
      COALESCE(sum(q) FILTER (WHERE disponible), 0)::int                     AS total_preguntas
    FROM tema_counts
    GROUP BY slug, nombre, short_name
    HAVING count(*) FILTER (WHERE disponible) > 0
    ORDER BY en_desarrollo DESC, finos DESC, disponibles DESC
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

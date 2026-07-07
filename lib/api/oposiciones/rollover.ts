// lib/api/oposiciones/rollover.ts
//
// "Rollover pendiente": oposiciones que PREPARAMOS (activas / con tests / landing)
// cuyo examen YA PASÓ y su landing sigue mirando al ciclo viejo → hay que pivotarla
// hacia delante (próxima OEP/convocatoria, exam_date, SEO forward), como manda el
// runbook crear-nueva-oposicion §2a.1-bis. El badge del nav avisa; la pestaña lista.
// SQL crudo vía getDb() (mismo patrón que competidores).

import { getDb } from '@/db/client'
import { sql } from 'drizzle-orm'

function rows<T>(res: unknown): T[] {
  return res as unknown as T[]
}

export interface RolloverItem {
  slug: string
  nombre: string
  estado_proceso: string | null
  exam_date: string | null
  dias_desde_examen: number
  usuarios: number
}

/** Cuenta para el badge del nav: oposiciones que preparamos con examen ya pasado. */
export async function getRolloverPendingCount(): Promise<{ success: true; count: number }> {
  const db = getDb()
  const res = await db.execute(sql`
    SELECT count(*)::int AS count
    FROM oposiciones o
    WHERE (o.is_active = true OR o.coverage_level IN ('con_tests', 'con_landing', 'full'))
      AND o.exam_date IS NOT NULL
      AND o.exam_date < now()
  `)
  return { success: true, count: Number(rows<{ count: number }>(res)[0]?.count ?? 0) }
}

/** Lista para la pestaña: las que necesitan rollover, más demandadas primero. */
export async function getRolloverPending(): Promise<{ success: true; items: RolloverItem[] }> {
  const db = getDb()
  const res = await db.execute(sql`
    SELECT o.slug, o.nombre, o.estado_proceso, o.exam_date::text AS exam_date,
      (now()::date - o.exam_date::date)::int AS dias_desde_examen,
      (SELECT count(*)::int FROM user_profiles up
         WHERE up.target_oposicion = o.slug OR up.target_oposicion = replace(o.slug, '-', '_')) AS usuarios
    FROM oposiciones o
    WHERE (o.is_active = true OR o.coverage_level IN ('con_tests', 'con_landing', 'full'))
      AND o.exam_date IS NOT NULL
      AND o.exam_date < now()
    ORDER BY usuarios DESC, o.exam_date ASC
  `)
  return { success: true, items: rows<RolloverItem>(res) }
}

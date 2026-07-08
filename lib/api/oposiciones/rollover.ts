// lib/api/oposiciones/rollover.ts
//
// "Rollover pendiente": oposiciones que PREPARAMOS (activas / con tests / landing)
// cuya landing NO mira hacia delante → hay que pivotarla al próximo ciclo (próxima
// OEP/convocatoria + hito forward + SEO), como manda docs/runbooks/rollover-oposiciones.md.
//
// GUARDRAIL (08/07/2026): una oposición está pendiente mientras NO tenga HORIZONTE,
// donde horizonte = examen futuro O un hito `upcoming` (fecha futura/sin fecha).
// Antes se contaba solo `exam_date < now`, así que un "pivote a medias" (poner
// exam_date=null SIN añadir el hito forward ni investigar la próxima OEP) hacía
// desaparecer la oposición del badge → APARENTABA hecho sin estarlo. Ahora ese
// dead-end sigue contando (motivo='sin_horizonte'). Lee de la vista oposiciones_ssot
// (lo que ve el usuario), no de las columnas legacy de oposiciones.

import { getDb } from '@/db/client'
import { sql } from 'drizzle-orm'

function rows<T>(res: unknown): T[] {
  return res as unknown as T[]
}

/**
 * Regla PURA (testeable) de si una oposición necesita rollover, espejo de la
 * lógica SQL de abajo (mantener en sync). Una oposición tiene HORIZONTE (rollover
 * hecho) si tiene examen futuro O un hito `upcoming` (fecha futura o sin fecha).
 * Sin horizonte → pendiente. Esto impide que un "pivote a medias" (poner
 * exam_date=null sin añadir el hito forward) esconda la oposición del radar.
 */
export function rolloverStatus(input: {
  examDate: Date | null
  hasUpcomingHito: boolean
  now?: Date
}): { pending: boolean; motivo: 'examen_pasado' | 'sin_horizonte' | null } {
  const now = input.now ?? new Date()
  const examFuturo = input.examDate !== null && input.examDate >= now
  const tieneHorizonte = examFuturo || input.hasUpcomingHito
  if (tieneHorizonte) return { pending: false, motivo: null }
  const examenPasado = input.examDate !== null && input.examDate < now
  return { pending: true, motivo: examenPasado ? 'examen_pasado' : 'sin_horizonte' }
}

export interface RolloverItem {
  slug: string
  nombre: string
  estado_proceso: string | null
  exam_date: string | null
  dias_desde_examen: number | null
  usuarios: number
  motivo: 'examen_pasado' | 'sin_horizonte'
}

// Una oposición TIENE HORIZONTE (rollover hecho, NO pendiente) si:
//   - su exam_date resuelto (SSOT) es futuro, O
//   - tiene un hito `upcoming` con fecha futura o sin fecha (pointer al próximo ciclo).
// Sin ninguna de las dos → dead-end → pendiente.
const SIN_HORIZONTE = sql`
  COALESCE(v.exam_date >= now(), false) = false
  AND NOT EXISTS (
    SELECT 1 FROM convocatoria_hitos h
    WHERE h.oposicion_id = o.id
      AND h.status = 'upcoming'
      AND (h.fecha IS NULL OR h.fecha >= now())
  )
`

const PREPARADA = sql`(o.is_active = true OR o.coverage_level IN ('con_tests', 'con_landing', 'full'))`

/** Cuenta para el badge del nav: oposiciones que preparamos SIN horizonte forward. */
export async function getRolloverPendingCount(): Promise<{ success: true; count: number }> {
  const db = getDb()
  const res = await db.execute(sql`
    SELECT count(*)::int AS count
    FROM oposiciones o
    JOIN oposiciones_ssot v ON v.slug = o.slug
    WHERE ${PREPARADA} AND ${SIN_HORIZONTE}
  `)
  return { success: true, count: Number(rows<{ count: number }>(res)[0]?.count ?? 0) }
}

/** Lista para la pestaña: las que necesitan rollover, más demandadas primero. */
export async function getRolloverPending(): Promise<{ success: true; items: RolloverItem[] }> {
  const db = getDb()
  const res = await db.execute(sql`
    SELECT o.slug, o.nombre, v.estado_proceso, v.exam_date::text AS exam_date,
      CASE WHEN v.exam_date IS NOT NULL THEN (now()::date - v.exam_date::date)::int END AS dias_desde_examen,
      (SELECT count(*)::int FROM user_profiles up
         WHERE up.target_oposicion = o.slug OR up.target_oposicion = replace(o.slug, '-', '_')) AS usuarios,
      CASE WHEN v.exam_date IS NOT NULL AND v.exam_date < now() THEN 'examen_pasado' ELSE 'sin_horizonte' END AS motivo
    FROM oposiciones o
    JOIN oposiciones_ssot v ON v.slug = o.slug
    WHERE ${PREPARADA} AND ${SIN_HORIZONTE}
    ORDER BY usuarios DESC, v.exam_date ASC NULLS LAST
  `)
  return { success: true, items: rows<RolloverItem>(res) }
}

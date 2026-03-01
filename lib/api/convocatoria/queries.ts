// lib/api/convocatoria/queries.ts
// Obtener convocatoria activa para una oposición

import { getDb } from '@/db/client'
import { sql } from 'drizzle-orm'

export interface ConvocatoriaActiva {
  año: number
  fechaExamen: string | null
  plazasConvocadas: number | null
  boletinOficialUrl: string | null
  paginaInformacionUrl: string | null
  observaciones: string | null
}

/**
 * Obtiene la convocatoria más reciente para una oposición por slug.
 * Devuelve null si la oposición no existe o no tiene convocatorias.
 */
export async function getConvocatoriaActiva(
  oposicionSlug: string
): Promise<ConvocatoriaActiva | null> {
  const db = getDb()

  const result = await db.execute<{
    año: number
    fecha_examen: string | null
    plazas_convocadas: number | null
    boletin_oficial_url: string | null
    pagina_informacion_url: string | null
    observaciones: string | null
  }>(sql`
    SELECT
      c.año,
      c.fecha_examen,
      c.plazas_convocadas,
      c.boletin_oficial_url,
      c.pagina_informacion_url,
      c.observaciones
    FROM convocatorias c
    INNER JOIN oposiciones o ON c.oposicion_id = o.id
    WHERE o.slug = ${oposicionSlug}
    ORDER BY c.año DESC
    LIMIT 1
  `)

  const rows = Array.isArray(result) ? result : (result as any).rows || []
  if (rows.length === 0) return null

  const row = rows[0]
  return {
    año: row.año,
    fechaExamen: row.fecha_examen,
    plazasConvocadas: row.plazas_convocadas,
    boletinOficialUrl: row.boletin_oficial_url,
    paginaInformacionUrl: row.pagina_informacion_url,
    observaciones: row.observaciones,
  }
}

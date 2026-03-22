// lib/api/convocatoria/queries.ts
// Obtener convocatoria activa para una oposición

import { getDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import { eq } from 'drizzle-orm'
import { oposiciones } from '@/db/schema'

export interface OposicionLandingData {
  nombre: string
  plazasLibres: number | null
  plazasPromocionInterna: number | null
  plazasDiscapacidad: number | null
  examDate: string | null
  inscriptionStart: string | null
  inscriptionDeadline: string | null
  boePublicationDate: string | null
  boeReference: string | null
  temasCount: number | null
  bloquesCount: number | null
  tituloRequerido: string | null
  salarioMin: number | null
  salarioMax: number | null
  programaUrl: string | null
  diarioOficial: string | null
  diarioReferencia: string | null
  seguimientoUrl: string | null
  isConvocatoriaActiva: boolean | null
}

/**
 * Obtiene datos de la tabla oposiciones para landing pages.
 * Usado por las landings estáticas para mostrar plazas, fechas, BOE, etc.
 */
export async function getOposicionLandingData(
  slug: string
): Promise<OposicionLandingData | null> {
  try {
    const db = getDb()

    const rows = await db
      .select({
        nombre: oposiciones.nombre,
        plazasLibres: oposiciones.plazasLibres,
        plazasPromocionInterna: oposiciones.plazasPromocionInterna,
        plazasDiscapacidad: oposiciones.plazasDiscapacidad,
        examDate: oposiciones.examDate,
        inscriptionStart: oposiciones.inscriptionStart,
        inscriptionDeadline: oposiciones.inscriptionDeadline,
        boePublicationDate: oposiciones.boePublicationDate,
        boeReference: oposiciones.boeReference,
        temasCount: oposiciones.temasCount,
        bloquesCount: oposiciones.bloquesCount,
        tituloRequerido: oposiciones.tituloRequerido,
        salarioMin: oposiciones.salarioMin,
        salarioMax: oposiciones.salarioMax,
        programaUrl: oposiciones.programaUrl,
        diarioOficial: oposiciones.diarioOficial,
        diarioReferencia: oposiciones.diarioReferencia,
        seguimientoUrl: oposiciones.seguimientoUrl,
        isConvocatoriaActiva: oposiciones.isConvocatoriaActiva,
      })
      .from(oposiciones)
      .where(eq(oposiciones.slug, slug))
      .limit(1)

    if (rows.length === 0) return null
    return rows[0]
  } catch (error) {
    console.warn(`⚠️ [convocatoria] Error obteniendo datos landing para ${slug}:`, (error as Error).message)
    return null
  }
}

export interface HitoConvocatoria {
  id: string
  fecha: string
  titulo: string
  descripcion: string | null
  url: string | null
  status: 'completed' | 'current' | 'upcoming'
  orderIndex: number
}

/**
 * Obtiene los hitos del proceso selectivo para una oposición.
 * Usado por las landings para mostrar el timeline del proceso.
 */
export async function getHitosConvocatoria(
  slug: string
): Promise<HitoConvocatoria[]> {
  try {
    const db = getDb()

    const rows = await db.execute<{
      id: string
      fecha: string
      titulo: string
      descripcion: string | null
      url: string | null
      status: string
      order_index: number
    }>(sql`
      SELECT h.id, h.fecha, h.titulo, h.descripcion, h.url, h.status, h.order_index
      FROM convocatoria_hitos h
      INNER JOIN oposiciones o ON h.oposicion_id = o.id
      WHERE o.slug = ${slug}
      ORDER BY h.order_index ASC
    `)

    const results = Array.isArray(rows) ? rows : (rows as any).rows || []
    return results.map((r: any) => ({
      id: r.id,
      fecha: r.fecha,
      titulo: r.titulo,
      descripcion: r.descripcion,
      url: r.url,
      status: r.status as 'completed' | 'current' | 'upcoming',
      orderIndex: r.order_index,
    }))
  } catch (error) {
    console.warn(`⚠️ [convocatoria] Error obteniendo hitos para ${slug}:`, (error as Error).message)
    return []
  }
}

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
  try {
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
  } catch (error) {
    console.warn(`⚠️ [convocatoria] Error obteniendo convocatoria para ${oposicionSlug}:`, (error as Error).message)
    return null
  }
}

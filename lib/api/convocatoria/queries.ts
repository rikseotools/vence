// lib/api/convocatoria/queries.ts
// Obtener convocatoria activa para una oposición

import { getDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import { eq } from 'drizzle-orm'
import { oposiciones, topics } from '@/db/schema'
import { asc, and } from 'drizzle-orm'
import { unstable_cache } from 'next/cache'

export interface OposicionLandingData {
  nombre: string
  plazasLibres: number | null
  plazasPromocionInterna: number | null
  plazasDiscapacidad: number | null
  examDate: string | null
  examDateApproximate: boolean | null
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
  oepDecreto: string | null
  oepFecha: string | null
  estadoProceso: string | null
  // Landing page data (JSONB)
  colorPrimario: string | null
  seoTitle: string | null
  seoDescription: string | null
  landingFaqs: Array<{ pregunta: string; respuesta: string }> | null
  examenConfig: Record<string, unknown> | null
  requisitosEspeciales: Array<{ tipo: string; nombre: string }> | null
  landingEstadisticas: Array<{ numero: string; texto: string; color: string }> | null
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
        examDateApproximate: oposiciones.examDateApproximate,
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
        oepDecreto: oposiciones.oepDecreto,
        oepFecha: oposiciones.oepFecha,
        estadoProceso: oposiciones.estadoProceso,
        colorPrimario: oposiciones.colorPrimario,
        seoTitle: oposiciones.seoTitle,
        seoDescription: oposiciones.seoDescription,
        landingFaqs: oposiciones.landingFaqs,
        examenConfig: oposiciones.examenConfig,
        requisitosEspeciales: oposiciones.requisitosEspeciales,
        landingEstadisticas: oposiciones.landingEstadisticas,
      })
      .from(oposiciones)
      .where(eq(oposiciones.slug, slug))
      .limit(1)

    if (rows.length === 0) return null
    // Cast JSONB fields (Drizzle los tipa como unknown)
    const row = rows[0]
    return {
      ...row,
      landingFaqs: row.landingFaqs as OposicionLandingData['landingFaqs'],
      examenConfig: row.examenConfig as OposicionLandingData['examenConfig'],
      requisitosEspeciales: row.requisitosEspeciales as OposicionLandingData['requisitosEspeciales'],
      landingEstadisticas: row.landingEstadisticas as OposicionLandingData['landingEstadisticas'],
    }
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

/**
 * Obtiene los nombres de los topics desde BD para el preview del temario en la landing.
 * Devuelve un mapa topic_number → title. Si falla, devuelve mapa vacío (fallback a config).
 */
export async function getTopicNamesForLanding(
  positionType: string
): Promise<Map<number, string>> {
  try {
    const db = getDb()
    const rows = await db
      .select({
        topicNumber: topics.topicNumber,
        title: topics.title,
      })
      .from(topics)
      .where(and(
        eq(topics.positionType, positionType),
        eq(topics.isActive, true),
      ))
      .orderBy(asc(topics.topicNumber))

    const map = new Map<number, string>()
    for (const r of rows) {
      if (r.topicNumber != null) map.set(r.topicNumber, r.title)
    }
    return map
  } catch {
    return new Map()
  }
}

export interface OposicionCardData {
  slug: string | null
  nombre: string
  shortName: string | null
  grupo: string | null
  subgrupo: string | null
  plazasLibres: number | null
  plazasPromocionInterna: number | null
  examDate: string | null
  boeReference: string | null
  boePublicationDate: string | null
  programaUrl: string | null
  seguimientoUrl: string | null
  tituloRequerido: string | null
  salarioMin: number | null
  salarioMax: number | null
  temasCount: number | null
  bloquesCount: number | null
  diarioOficial: string | null
  isConvocatoriaActiva: boolean | null
  landingDescription: string | null
  landingFeatures: string[] | null
  landingRequirements: string[] | null
  landingDifficulty: string | null
  landingDuration: string | null
}

/**
 * Obtiene datos de todas las oposiciones activas para la página /nuestras-oposiciones.
 * Devuelve un mapa slug → datos para merge rápido con la config.
 */
export async function getAllOposicionesCardData(): Promise<Map<string, OposicionCardData>> {
  try {
    const db = getDb()

    const rows = await db.execute(sql`
      SELECT slug, nombre, short_name, grupo, subgrupo,
             plazas_libres, plazas_promocion_interna,
             exam_date, boe_reference, boe_publication_date,
             programa_url, seguimiento_url,
             titulo_requerido, salario_min, salario_max,
             temas_count, bloques_count, diario_oficial,
             is_convocatoria_activa,
             landing_description, landing_features, landing_requirements,
             landing_difficulty, landing_duration
      FROM oposiciones
      WHERE is_active = true AND slug IS NOT NULL
      ORDER BY nombre
    `)

    const results = Array.isArray(rows) ? rows : (rows as any).rows || []
    const map = new Map<string, OposicionCardData>()

    for (const r of results as any[]) {
      if (!r.slug) continue
      map.set(r.slug, {
        slug: r.slug,
        nombre: r.nombre,
        shortName: r.short_name,
        grupo: r.grupo,
        subgrupo: r.subgrupo,
        plazasLibres: r.plazas_libres,
        plazasPromocionInterna: r.plazas_promocion_interna,
        examDate: r.exam_date,
        boeReference: r.boe_reference,
        boePublicationDate: r.boe_publication_date,
        programaUrl: r.programa_url,
        seguimientoUrl: r.seguimiento_url,
        tituloRequerido: r.titulo_requerido,
        salarioMin: r.salario_min,
        salarioMax: r.salario_max,
        temasCount: r.temas_count,
        bloquesCount: r.bloques_count,
        diarioOficial: r.diario_oficial,
        isConvocatoriaActiva: r.is_convocatoria_activa,
        landingDescription: r.landing_description,
        landingFeatures: r.landing_features,
        landingRequirements: r.landing_requirements,
        landingDifficulty: r.landing_difficulty,
        landingDuration: r.landing_duration,
      })
    }

    return map
  } catch (error) {
    console.warn('⚠️ [convocatoria] Error obteniendo datos para cards:', (error as Error).message)
    return new Map()
  }
}

// ============================================
// CACHED WRAPPERS (tag: 'landing')
// ============================================
// Mismo patrón que random-test/queries.ts:78-87 y temario/teoria.
// Las landings declaran `dynamic = 'force-dynamic'` (no SSG en build), pero
// las queries internas se cachean permanentemente para evitar saturar Supabase
// durante el warmup post-deploy de ~963 URLs y el tráfico SEO.
// Invalidar con: revalidateTag('landing') — tag ya whitelisted en
// /api/admin/revalidate y disparado por /api/admin/revalidate-temario.

export const getOposicionLandingDataCached = unstable_cache(
  getOposicionLandingData,
  ['oposicion-landing-data-v1'],
  { revalidate: false, tags: ['landing'] }
)

export const getHitosConvocatoriaCached = unstable_cache(
  getHitosConvocatoria,
  ['hitos-convocatoria-v1'],
  { revalidate: false, tags: ['landing'] }
)

// Map<number, string> no es serializable a JSON; cacheamos como array de tuplas
// y reconstruimos el Map en el caller con `new Map(result)`.
async function getTopicNamesForLandingEntries(positionType: string): Promise<[number, string][]> {
  const map = await getTopicNamesForLanding(positionType)
  return Array.from(map.entries())
}

export const getTopicNamesForLandingCached = unstable_cache(
  getTopicNamesForLandingEntries,
  ['topic-names-for-landing-v1'],
  { revalidate: false, tags: ['landing'] }
)

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

// lib/api/convocatoria/queries.ts
// Obtener convocatoria activa para una oposición

// CANARY pooler (sweep masivo oleada 5 — todos user-facing 2026-05-10):
import { getDb, getPoolerDb } from '@/db/client'

function getConvocatoriaDb() {
  return process.env.USE_SELF_HOSTED_POOLER === 'true' ? getPoolerDb() : getDb()
}
import { sql } from 'drizzle-orm'
import { eq } from 'drizzle-orm'
import { topics } from '@/db/schema'
import { asc, and } from 'drizzle-orm'
import { unstable_cache } from 'next/cache'
import { versionedCache } from '@/lib/cache/versionedCache'

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
    const db = getConvocatoriaDb()

    // Lee de la VISTA `oposiciones_ssot` (fuente única): drop-in de `oposiciones` cuyos
    // campos temporales (plazas/fechas/estado/BOE/OEP/landing_*) ya vienen COALESCE'd de
    // la convocatoria vigente (`convocatorias` is_current) con fallback a las columnas
    // legacy de `oposiciones`. El merge vive SOLO en la vista (migración Sprint G:
    // docs/roadmap/consolidacion-convocatorias-radar-ssot.md). Así landing y catálogo
    // leen la MISMA fuente. SQL crudo porque no hay modelo Drizzle del `convocatorias` vivo.
    const rows = await db.execute<{
      nombre: string
      plazas_libres: number | null
      plazas_promocion_interna: number | null
      plazas_discapacidad: number | null
      exam_date: string | null
      exam_date_approximate: boolean | null
      inscription_start: string | null
      inscription_deadline: string | null
      boe_publication_date: string | null
      boe_reference: string | null
      temas_count: number | null
      bloques_count: number | null
      titulo_requerido: string | null
      salario_min: number | null
      salario_max: number | null
      programa_url: string | null
      diario_oficial: string | null
      diario_referencia: string | null
      seguimiento_url: string | null
      is_convocatoria_activa: boolean | null
      oep_decreto: string | null
      oep_fecha: string | null
      estado_proceso: string | null
      color_primario: string | null
      seo_title: string | null
      seo_description: string | null
      landing_faqs: unknown
      examen_config: unknown
      requisitos_especiales: unknown
      landing_estadisticas: unknown
    }>(sql`
      SELECT
        nombre,
        plazas_libres, plazas_promocion_interna, plazas_discapacidad,
        exam_date::text AS exam_date, exam_date_approximate,
        inscription_start::text AS inscription_start, inscription_deadline::text AS inscription_deadline,
        boe_publication_date::text AS boe_publication_date, boe_reference,
        temas_count, bloques_count, titulo_requerido, salario_min, salario_max,
        programa_url, diario_oficial, diario_referencia, seguimiento_url,
        is_convocatoria_activa, oep_decreto, oep_fecha::text AS oep_fecha, estado_proceso,
        color_primario, seo_title, seo_description,
        landing_faqs, examen_config, requisitos_especiales, landing_estadisticas
      FROM oposiciones_ssot
      WHERE slug = ${slug}
      LIMIT 1
    `)

    const results = Array.isArray(rows) ? rows : (rows as { rows?: unknown[] }).rows || []
    if (results.length === 0) return null
    const r = results[0] as Record<string, unknown>
    return {
      nombre: r.nombre as string,
      plazasLibres: r.plazas_libres as number | null,
      plazasPromocionInterna: r.plazas_promocion_interna as number | null,
      plazasDiscapacidad: r.plazas_discapacidad as number | null,
      examDate: r.exam_date as string | null,
      examDateApproximate: r.exam_date_approximate as boolean | null,
      inscriptionStart: r.inscription_start as string | null,
      inscriptionDeadline: r.inscription_deadline as string | null,
      boePublicationDate: r.boe_publication_date as string | null,
      boeReference: r.boe_reference as string | null,
      temasCount: r.temas_count as number | null,
      bloquesCount: r.bloques_count as number | null,
      tituloRequerido: r.titulo_requerido as string | null,
      salarioMin: r.salario_min as number | null,
      salarioMax: r.salario_max as number | null,
      programaUrl: r.programa_url as string | null,
      diarioOficial: r.diario_oficial as string | null,
      diarioReferencia: r.diario_referencia as string | null,
      seguimientoUrl: r.seguimiento_url as string | null,
      isConvocatoriaActiva: r.is_convocatoria_activa as boolean | null,
      oepDecreto: r.oep_decreto as string | null,
      oepFecha: r.oep_fecha as string | null,
      estadoProceso: r.estado_proceso as string | null,
      colorPrimario: r.color_primario as string | null,
      seoTitle: r.seo_title as string | null,
      seoDescription: r.seo_description as string | null,
      landingFaqs: r.landing_faqs as OposicionLandingData['landingFaqs'],
      examenConfig: r.examen_config as OposicionLandingData['examenConfig'],
      requisitosEspeciales: r.requisitos_especiales as OposicionLandingData['requisitosEspeciales'],
      landingEstadisticas: r.landing_estadisticas as OposicionLandingData['landingEstadisticas'],
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
    const db = getConvocatoriaDb()

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
    const db = getConvocatoriaDb()
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
 * Obtiene datos de todas las oposiciones activas (originalmente para /nuestras-oposiciones,
 * que ahora es 308 redirect a /oposiciones — esta query queda disponible para
 * cualquier listado que necesite cards de oposiciones desde BD).
 * Devuelve un mapa slug → datos para merge rápido con la config.
 */
export async function getAllOposicionesCardData(): Promise<Map<string, OposicionCardData>> {
  try {
    const db = getConvocatoriaDb()

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
      FROM oposiciones_ssot
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

export const getOposicionLandingDataCached = versionedCache(
  getOposicionLandingData,
  { tag: 'landing', keyParts: ['oposicion-landing-data-v1'] }
  )

export const getHitosConvocatoriaCached = versionedCache(
  getHitosConvocatoria,
  { tag: 'landing', keyParts: ['hitos-convocatoria-v1'] }
  )

// Map<number, string> no es serializable a JSON; cacheamos como array de tuplas
// y reconstruimos el Map en el caller con `new Map(result)`.
async function getTopicNamesForLandingEntries(positionType: string): Promise<[number, string][]> {
  const map = await getTopicNamesForLanding(positionType)
  return Array.from(map.entries())
}

export const getTopicNamesForLandingCached = versionedCache(
  getTopicNamesForLandingEntries,
  { tag: 'landing', keyParts: ['topic-names-for-landing-v1'] }
  )

// [Retirado 06/07/2026, Fase 4] `getConvocatoriaActiva` + `ConvocatoriaActiva` eliminados:
// consultaban el esquema ANTIGUO de `convocatorias` (fecha_examen/plazas_convocadas/…),
// que ya no existe (esas columnas vivían en `convocatorias_legacy`, tabla dropeada).
// Era código muerto (0 consumidores; su único uso, <ConvocatoriaLinks>, también retirado).
// La convocatoria vigente se lee ahora vía la vista `oposiciones_ssot`.

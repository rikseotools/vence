// lib/api/oep-signals/queries.ts
// Queries tipadas para señales de detección de OEPs
import { getDb } from '@/db/client'
import { oepDetectionSignals, oposiciones, convocatoriaHitos } from '@/db/schema'
import { eq, and, desc, sql, gte, lt, isNotNull } from 'drizzle-orm'
import type {
  CreateSignalInput,
  SignalRow,
  ReviewSignalInput,
  ListSignalsResponse,
  PendingSignalsCountResponse,
  SignalStatus,
} from './schemas'

// ============================================
// OPOSICIONES ACTIVAS CON seguimiento_url (para Sensor 1 LLM)
// ============================================

export interface OposicionToScan {
  id: string
  nombre: string
  slug: string | null
  shortName: string | null
  seguimientoUrl: string
  estadoProceso: string | null
  plazasLibres: number | null
  plazasDiscapacidad: number | null
  oepFecha: string | null
  convocatoriaNumero: string | null
}

export async function getOposicionesForLlmScan(): Promise<OposicionToScan[]> {
  const db = getDb()
  const rows = await db
    .select({
      id: oposiciones.id,
      nombre: oposiciones.nombre,
      slug: oposiciones.slug,
      shortName: oposiciones.shortName,
      seguimientoUrl: oposiciones.seguimientoUrl,
      estadoProceso: oposiciones.estadoProceso,
      plazasLibres: oposiciones.plazasLibres,
      plazasDiscapacidad: oposiciones.plazasDiscapacidad,
      oepFecha: oposiciones.oepFecha,
      convocatoriaNumero: oposiciones.convocatoriaNumero,
    })
    .from(oposiciones)
    // Radar OEP: escanea TODA seguimiento_url, incluidas catalogadas (is_active=false).
    // Manuel 19/06/2026: todas las C1/C2 al radar aunque no se construyan.
    .where(isNotNull(oposiciones.seguimientoUrl))
    .orderBy(oposiciones.nombre)

  return rows.filter(r => r.seguimientoUrl !== null) as OposicionToScan[]
}

// ============================================
// INSERT SIGNAL (dedupe via ON CONFLICT)
// ============================================

export async function insertSignal(input: CreateSignalInput): Promise<{ inserted: boolean; id: string | null }> {
  const db = getDb()
  try {
    const result = await db
      .insert(oepDetectionSignals)
      .values({
        oposicionId: input.oposicionId ?? null,
        sourceId: input.sourceId ?? null,
        regionName: input.regionName ?? null,
        positionCategory: input.positionCategory ?? null,
        detectedOposicionName: input.detectedOposicionName ?? null,
        sensorType: input.sensorType,
        sourceUrl: input.sourceUrl ?? null,
        detectedYear: input.detectedYear ?? null,
        detectedPlazasLibre: input.detectedPlazasLibre ?? null,
        detectedPlazasDiscapacidad: input.detectedPlazasDiscapacidad ?? null,
        detectedPlazasPromocionInterna: input.detectedPlazasPromocionInterna ?? null,
        detectedBocRef: input.detectedBocRef ?? null,
        detectedFechaPublicacion: input.detectedFechaPublicacion ?? null,
        detectedFechaInscripcionFin: input.detectedFechaInscripcionFin ?? null,
        detectedFechaExamen: input.detectedFechaExamen ?? null,
        detectedEstado: input.detectedEstado ?? null,
        confidenceScore: input.confidenceScore,
        isNovel: input.isNovel,
        signalSummary: input.signalSummary,
        rawExtraction: (input.rawExtraction ?? {}) as Record<string, unknown>,
        dedupeKey: input.dedupeKey ?? null,
      })
      .onConflictDoNothing({ target: oepDetectionSignals.dedupeKey })
      .returning({ id: oepDetectionSignals.id })

    if (result.length === 0) {
      return { inserted: false, id: null }
    }
    return { inserted: true, id: result[0].id }
  } catch (err) {
    console.error('❌ [OepSignals] Error insertSignal:', err)
    throw err
  }
}

// ============================================
// LISTAR SEÑALES (admin)
// ============================================

export async function listSignals(filters: { status?: SignalStatus; limit?: number; scope?: 'all' | 'known' | 'regional' }): Promise<ListSignalsResponse> {
  const db = getDb()
  const limit = filters.limit ?? 100

  const conds = []
  if (filters.status) conds.push(eq(oepDetectionSignals.status, filters.status))
  if (filters.scope === 'regional') conds.push(sql`${oepDetectionSignals.oposicionId} IS NULL`)
  if (filters.scope === 'known') conds.push(sql`${oepDetectionSignals.oposicionId} IS NOT NULL`)

  const rows = await db
    .select({
      id: oepDetectionSignals.id,
      oposicionId: oepDetectionSignals.oposicionId,
      oposicionNombre: oposiciones.nombre,
      oposicionSlug: oposiciones.slug,
      sourceId: oepDetectionSignals.sourceId,
      regionName: oepDetectionSignals.regionName,
      positionCategory: oepDetectionSignals.positionCategory,
      detectedOposicionName: oepDetectionSignals.detectedOposicionName,
      sensorType: oepDetectionSignals.sensorType,
      sourceUrl: oepDetectionSignals.sourceUrl,
      detectedYear: oepDetectionSignals.detectedYear,
      detectedPlazasLibre: oepDetectionSignals.detectedPlazasLibre,
      detectedPlazasDiscapacidad: oepDetectionSignals.detectedPlazasDiscapacidad,
      detectedPlazasPromocionInterna: oepDetectionSignals.detectedPlazasPromocionInterna,
      detectedBocRef: oepDetectionSignals.detectedBocRef,
      detectedFechaPublicacion: oepDetectionSignals.detectedFechaPublicacion,
      detectedFechaInscripcionFin: oepDetectionSignals.detectedFechaInscripcionFin,
      detectedFechaExamen: oepDetectionSignals.detectedFechaExamen,
      detectedEstado: oepDetectionSignals.detectedEstado,
      confidenceScore: oepDetectionSignals.confidenceScore,
      isNovel: oepDetectionSignals.isNovel,
      signalSummary: oepDetectionSignals.signalSummary,
      status: oepDetectionSignals.status,
      reviewedAt: oepDetectionSignals.reviewedAt,
      adminNotes: oepDetectionSignals.adminNotes,
      createdAt: oepDetectionSignals.createdAt,
    })
    .from(oepDetectionSignals)
    .leftJoin(oposiciones, eq(oepDetectionSignals.oposicionId, oposiciones.id))
    .where(conds.length > 0 ? and(...conds) : undefined)
    .orderBy(desc(oepDetectionSignals.createdAt))
    .limit(limit)

  // Counts por estado
  const countsRows = await db
    .select({
      status: oepDetectionSignals.status,
      count: sql<number>`count(*)::int`,
    })
    .from(oepDetectionSignals)
    .groupBy(oepDetectionSignals.status)

  const counts = { pending: 0, applied: 0, dismissed: 0 }
  for (const r of countsRows) {
    if (r.status === 'pending') counts.pending = r.count
    else if (r.status === 'applied' || r.status === 'auto_applied') counts.applied += r.count
    else if (r.status === 'dismissed') counts.dismissed = r.count
  }

  return {
    success: true,
    signals: rows as SignalRow[],
    counts,
  }
}

// ============================================
// COUNT PENDING (para badge admin)
// ============================================

export async function getPendingSignalsCount(): Promise<PendingSignalsCountResponse> {
  const db = getDb()
  const [total, critical, discovered] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(oepDetectionSignals)
      .where(eq(oepDetectionSignals.status, 'pending')),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(oepDetectionSignals)
      .where(and(
        eq(oepDetectionSignals.status, 'pending'),
        gte(oepDetectionSignals.confidenceScore, 60),
      )),
    // Procesos descubiertos fuera de catálogo (sensor regional_scan).
    // Tabla nueva sin modelo Drizzle todavía → SQL crudo. Solo activos.
    db.execute(sql`
      SELECT count(*)::int AS count
      FROM discovered_processes
      WHERE manuel_status IN ('new', 'watching')
    `),
  ])

  return {
    success: true,
    pendingCount: total[0]?.count ?? 0,
    criticalCount: critical[0]?.count ?? 0,
    discoveredCount: Number((discovered as unknown as Array<{ count: number }>)[0]?.count ?? 0),
  }
}

// ============================================
// REVIEW SIGNAL (apply | dismiss)
// ============================================

export async function reviewSignal(input: ReviewSignalInput): Promise<{ success: boolean; error?: string }> {
  const db = getDb()
  const newStatus: SignalStatus = input.action === 'apply' ? 'applied' : 'dismissed'

  const result = await db
    .update(oepDetectionSignals)
    .set({
      status: newStatus,
      reviewedAt: new Date().toISOString(),
      adminNotes: input.adminNotes ?? null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(oepDetectionSignals.id, input.signalId))
    .returning({ id: oepDetectionSignals.id })

  if (result.length === 0) {
    return { success: false, error: 'Señal no encontrada' }
  }
  return { success: true }
}

// ============================================
// MATCH DETECTED OEP vs existing oposiciones
// ============================================

export interface MatchResult {
  matched: boolean
  oposicionId: string | null
  oposicionNombre: string | null
  matchConfidence: 'exact' | 'fuzzy' | 'none'
}

/**
 * Intenta match de una OEP extraída vía LLM contra oposiciones existentes.
 * Usa normalización + keyword matching por administración/tipo.
 */
export async function matchDetectedOepToOposicion(params: {
  detectedName: string
  regionName: string
  bocRef?: string | null
}): Promise<MatchResult> {
  const db = getDb()

  // 1) Si hay BOC ref, match exacto por convocatoria_numero
  if (params.bocRef) {
    const byBoc = await db
      .select({ id: oposiciones.id, nombre: oposiciones.nombre })
      .from(oposiciones)
      .where(eq(oposiciones.convocatoriaNumero, params.bocRef))
      .limit(1)
    if (byBoc.length > 0) {
      return { matched: true, oposicionId: byBoc[0].id, oposicionNombre: byBoc[0].nombre, matchConfidence: 'exact' }
    }
  }

  // 2) Match fuzzy por nombre + región
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9ñ]/g, ' ').replace(/\s+/g, ' ').trim()
  const detected = normalize(params.detectedName)
  const region = normalize(params.regionName)

  // Keywords clave
  const hasAuxAdmin = /auxiliar\s*admin/.test(detected)
  const hasAdmin = /administrativ/.test(detected) && !hasAuxAdmin

  // Buscar oposiciones activas que mencionen la región
  const all = await db
    .select({
      id: oposiciones.id,
      nombre: oposiciones.nombre,
      slug: oposiciones.slug,
      subgrupo: oposiciones.subgrupo,
    })
    .from(oposiciones)
    // Permite enlazar señales descubiertas (BOE/BOCYL) también a oposiciones
    // catalogadas (is_active=false), no solo a las activas.
    .where(isNotNull(oposiciones.seguimientoUrl))

  for (const o of all) {
    const nomNorm = normalize(o.nombre)
    const slugNorm = normalize(o.slug ?? '')
    const regionInSlug = slugNorm.includes(region) || nomNorm.includes(region)
    if (!regionInSlug) continue

    // Match C2 (aux admin)
    if (hasAuxAdmin && /auxiliar|c2/.test(nomNorm + ' ' + (o.subgrupo ?? ''))) {
      return { matched: true, oposicionId: o.id, oposicionNombre: o.nombre, matchConfidence: 'fuzzy' }
    }
    // Match C1 (admin)
    if (hasAdmin && /administrativ|c1/.test(nomNorm + ' ' + (o.subgrupo ?? ''))) {
      return { matched: true, oposicionId: o.id, oposicionNombre: o.nombre, matchConfidence: 'fuzzy' }
    }
  }

  return { matched: false, oposicionId: null, oposicionNombre: null, matchConfidence: 'none' }
}

// ============================================
// TIMELINE SILENCE (Sensor 3)
// ============================================

export interface TimelineSilenceCandidate {
  oposicionId: string
  oposicionNombre: string
  oposicionSlug: string | null
  hitoId: string
  hitoTitulo: string
  hitoFecha: string
  diasRetraso: number
}

/**
 * Detecta hitos con status='current' cuya fecha ya pasó hace >3 días sin haberse
 * actualizado a 'completed'. Señal de que esperábamos algo y no ha pasado.
 */
export async function findTimelineSilences(graceDays = 3): Promise<TimelineSilenceCandidate[]> {
  const db = getDb()
  const thresholdDate = new Date()
  thresholdDate.setDate(thresholdDate.getDate() - graceDays)
  const threshold = thresholdDate.toISOString().slice(0, 10)

  const rows = await db
    .select({
      oposicionId: convocatoriaHitos.oposicionId,
      oposicionNombre: oposiciones.nombre,
      oposicionSlug: oposiciones.slug,
      hitoId: convocatoriaHitos.id,
      hitoTitulo: convocatoriaHitos.titulo,
      hitoFecha: convocatoriaHitos.fecha,
    })
    .from(convocatoriaHitos)
    .leftJoin(oposiciones, eq(convocatoriaHitos.oposicionId, oposiciones.id))
    .where(and(
      eq(convocatoriaHitos.status, 'current'),
      lt(convocatoriaHitos.fecha, threshold),
      eq(oposiciones.isActive, true),
    ))

  return rows.map(r => {
    const fechaDate = new Date(r.hitoFecha)
    const hoyDate = new Date()
    const diffMs = hoyDate.getTime() - fechaDate.getTime()
    const diasRetraso = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    return {
      oposicionId: r.oposicionId,
      oposicionNombre: r.oposicionNombre ?? '',
      oposicionSlug: r.oposicionSlug,
      hitoId: r.hitoId,
      hitoTitulo: r.hitoTitulo,
      hitoFecha: r.hitoFecha,
      diasRetraso,
    }
  })
}

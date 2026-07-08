// lib/api/oep-signals/queries.ts
// Queries tipadas para señales de detección de OEPs
import { getDb } from '@/db/client'
import { oepDetectionSignals, convocatoriaHitos } from '@/db/schema'
// El matcher LEE oposiciones desde la vista SSOT (convocatoria vigente + fallback),
// así reconcilia señales contra estado/plazas frescos. Solo lectura.
import { oposicionesSsot as oposiciones } from '@/db/oposicionesSsot'
import { eq, and, desc, sql, gte, lt, isNotNull } from 'drizzle-orm'
import { revalidateTag } from 'next/cache'
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
  const [total, critical] = await Promise.all([
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
  ])

  return {
    success: true,
    pendingCount: total[0]?.count ?? 0,
    criticalCount: critical[0]?.count ?? 0,
    // Fase 4: `discovered_processes` retirada (experimento muerto, badge siempre 0).
    // Se mantiene el campo por compat del schema; sin lectura a la tabla.
    discoveredCount: 0,
  }
}

// ============================================
// REVIEW SIGNAL (apply | dismiss)
// ============================================

/**
 * Fase 3 — Puente radar → SSOT (docs/roadmap/consolidacion-convocatorias-radar-ssot.md).
 * Al APLICAR una señal matcheada (con `oposicion_id`), promueve sus `detected_*` a la
 * convocatoria VIGENTE de esa oposición (el SSOT que lee toda la app) + dual-write a
 * `oposiciones.*` (que aún leen advance-estado y los auditores durante la transición).
 * Reglas de seguridad:
 *  - COALESCE: solo escribe los campos que la señal DETECTÓ; nunca pisa un valor curado con NULL.
 *  - Si `detected_year` abre un CICLO nuevo (> año vigente), archiva la vigente e inserta otra.
 *  - Escribe primero el SSOT (`convocatorias`) y luego el legacy → si algo falla, los lectores
 *    (que van por la vista) ya ven el dato correcto.
 *  - El admin VE los `detected_*` en el panel antes de Aplicar → es acción verificada (§4e).
 * SQL crudo porque `convocatorias` no está en el schema Drizzle (y así escribe la tabla real,
 * no la vista aliased). Devuelve el tipo de operación o null si no había nada que promover.
 */
/**
 * GUARDRAIL puro (testeable): el estado a escribir al promover una señal a la
 * SSOT. NO se puede afirmar 'inscripcion_abierta'/'convocada' sin fecha de cierre
 * (`inscription_deadline`) — sin ella la tarjeta queda invisible en la home (que
 * filtra por fechas) y es el patrón de las catalogadas stale. `advance-estado`
 * derivará el estado correcto desde las fechas cuando existan. Otros estados
 * (resultados, nombramientos…) pasan tal cual.
 */
export function estadoParaPromover(
  detectedEstado: string | null,
  tieneDeadline: boolean,
): string | null {
  if (
    (detectedEstado === 'inscripcion_abierta' || detectedEstado === 'convocada') &&
    !tieneDeadline
  ) {
    return null
  }
  return detectedEstado
}

async function promoteSignalToConvocatoria(
  db: ReturnType<typeof getDb>,
  signalId: string,
): Promise<{ oposicionId: string; result: 'updated' | 'inserted' | 'new_cycle' } | null> {
  const rows = (await db.execute<Record<string, unknown>>(sql`
    SELECT oposicion_id, detected_year, detected_plazas_libre, detected_plazas_discapacidad,
           detected_plazas_promocion_interna, detected_boc_ref,
           detected_fecha_publicacion::text  AS detected_fecha_publicacion,
           detected_fecha_inscripcion_fin::text AS detected_fecha_inscripcion_fin,
           detected_fecha_examen::text       AS detected_fecha_examen,
           detected_estado
    FROM oep_detection_signals WHERE id = ${signalId} LIMIT 1`)) as unknown
  const s = (Array.isArray(rows) ? rows : (rows as { rows?: unknown[] }).rows || [])[0] as Record<string, unknown> | undefined
  if (!s || !s.oposicion_id) return null

  const oposicionId = s.oposicion_id as string
  const yr = (s.detected_year ?? null) as number | null
  const pl = (s.detected_plazas_libre ?? null) as number | null
  const pd = (s.detected_plazas_discapacidad ?? null) as number | null
  const ppi = (s.detected_plazas_promocion_interna ?? null) as number | null
  const boc = (s.detected_boc_ref ?? null) as string | null
  const fpub = (s.detected_fecha_publicacion ?? null) as string | null
  const fins = (s.detected_fecha_inscripcion_fin ?? null) as string | null
  const fex = (s.detected_fecha_examen ?? null) as string | null
  const est = (s.detected_estado ?? null) as string | null

  // GUARDRAIL (08/07): NO afirmar 'inscripcion_abierta'/'convocada' SIN fecha de
  // cierre (ver estadoParaPromover). Sin deadline no se sabe si el plazo está
  // abierto → dejar que advance-estado derive el estado desde fechas.
  const estToWrite = estadoParaPromover(est, fins != null)

  // ¿algo que promover?
  if ([yr, pl, pd, ppi, boc, fpub, fins, fex, estToWrite].every((v) => v === null)) return null

  const curRows = (await db.execute<{ id: string; anio: number | null }>(sql`
    SELECT id, "año" AS anio FROM convocatorias WHERE oposicion_id = ${oposicionId} AND is_current = true LIMIT 1`)) as unknown
  const cur = (Array.isArray(curRows) ? curRows : (curRows as { rows?: unknown[] }).rows || [])[0] as { id: string; anio: number | null } | undefined

  let result: 'updated' | 'inserted' | 'new_cycle'
  if (cur && !(yr !== null && cur.anio !== null && yr > cur.anio)) {
    // Mismo ciclo → UPDATE de la vigente (COALESCE, sin pisar con NULL).
    await db.execute(sql`
      UPDATE convocatorias SET
        plazas_libres            = COALESCE(${pl},   plazas_libres),
        plazas_discapacidad      = COALESCE(${pd},   plazas_discapacidad),
        plazas_promocion_interna = COALESCE(${ppi},  plazas_promocion_interna),
        convocatoria_numero      = COALESCE(${boc},  convocatoria_numero),
        boe_publication_date     = COALESCE(${fpub}::date, boe_publication_date),
        inscription_deadline     = COALESCE(${fins}::date, inscription_deadline),
        exam_date                = COALESCE(${fex}::date,  exam_date),
        estado_proceso           = COALESCE(${estToWrite},  estado_proceso),
        updated_at = now()
      WHERE id = ${cur.id}`)
    result = 'updated'
  } else {
    // Ciclo nuevo (o sin convocatoria vigente) → archivar la vigente (si la hay) + INSERT.
    if (cur) {
      await db.execute(sql`UPDATE convocatorias SET is_current = false, archived_at = now(), updated_at = now() WHERE id = ${cur.id}`)
    }
    await db.execute(sql`
      INSERT INTO convocatorias (oposicion_id, "año", is_current, plazas_libres, plazas_discapacidad,
        plazas_promocion_interna, convocatoria_numero, boe_publication_date, inscription_deadline, exam_date, estado_proceso)
      VALUES (${oposicionId}, COALESCE(${yr}, EXTRACT(YEAR FROM CURRENT_DATE)::int), true,
        ${pl}, ${pd}, ${ppi}, ${boc}, ${fpub}::date, ${fins}::date, ${fex}::date, ${estToWrite})
      ON CONFLICT (oposicion_id, "año") DO UPDATE SET
        is_current = true, archived_at = NULL,
        plazas_libres            = COALESCE(EXCLUDED.plazas_libres,            convocatorias.plazas_libres),
        plazas_discapacidad      = COALESCE(EXCLUDED.plazas_discapacidad,      convocatorias.plazas_discapacidad),
        plazas_promocion_interna = COALESCE(EXCLUDED.plazas_promocion_interna, convocatorias.plazas_promocion_interna),
        convocatoria_numero      = COALESCE(EXCLUDED.convocatoria_numero,      convocatorias.convocatoria_numero),
        boe_publication_date     = COALESCE(EXCLUDED.boe_publication_date,     convocatorias.boe_publication_date),
        inscription_deadline     = COALESCE(EXCLUDED.inscription_deadline,     convocatorias.inscription_deadline),
        exam_date                = COALESCE(EXCLUDED.exam_date,                convocatorias.exam_date),
        estado_proceso           = COALESCE(EXCLUDED.estado_proceso,           convocatorias.estado_proceso),
        updated_at = now()`)
    result = cur ? 'new_cycle' : 'inserted'
  }

  // Dual-write legacy a oposiciones.* (advance-estado lee fechas de aquí; auditores). Sin updated_at (no existe).
  await db.execute(sql`
    UPDATE oposiciones SET
      plazas_libres            = COALESCE(${pl},   plazas_libres),
      plazas_discapacidad      = COALESCE(${pd},   plazas_discapacidad),
      plazas_promocion_interna = COALESCE(${ppi},  plazas_promocion_interna),
      convocatoria_numero      = COALESCE(${boc},  convocatoria_numero),
      boe_publication_date     = COALESCE(${fpub}::date, boe_publication_date),
      inscription_deadline     = COALESCE(${fins}::date, inscription_deadline),
      exam_date                = COALESCE(${fex}::date,  exam_date),
      estado_proceso           = COALESCE(${est},  estado_proceso)
    WHERE id = ${oposicionId}`)

  return { oposicionId, result }
}

export async function reviewSignal(input: ReviewSignalInput): Promise<{ success: boolean; error?: string; promoted?: string }> {
  const db = getDb()
  const newStatus: SignalStatus = input.action === 'apply' ? 'applied' : 'dismissed'

  // Fase 3 — puente radar → SSOT: al APLICAR, promover los detected_* a la convocatoria
  // vigente ANTES de marcar la señal aplicada. Si la promoción falla, no la marcamos
  // (el admin ve el error y reintenta). "Descartar" no promueve nada.
  let promoted: string | undefined
  if (input.action === 'apply') {
    try {
      const p = await promoteSignalToConvocatoria(db, input.signalId)
      promoted = p?.result
    } catch (e) {
      return { success: false, error: 'Error promoviendo a convocatoria: ' + (e as Error).message }
    }
  }

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

  // Se tocó convocatorias/oposiciones → refrescar landing (el catálogo caduca solo).
  if (promoted) {
    try { revalidateTag('landing', 'max') } catch { /* fuera de request scope: no-op */ }
  }
  return { success: true, promoted }
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

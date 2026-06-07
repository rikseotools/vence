// lib/api/oposicion-scope/queries.ts
// Helper centralizado para derivar qué leyes son válidas (scope) para un usuario/oposición.
// Fuente de verdad: topic_scope × topics.position_type.
//
// Usarlo en TODO endpoint que filtre preguntas por oposición para evitar bugs
// cross-oposición tipo dispute 4e247ddc (Mar Aux Estado recibiendo contenido CyL).
//
// Ver project_oposicion_scope_refactor.md para contexto y fases.

// CANARY self-hosted pooler (Fase 4 oleada 4 — sweep masivo 2026-05-10):
// oposicion-scope (helper transversal) migrado al pooler propio para reducir presión Supavisor.
import { getDb, getPoolerDb } from '@/db/client'

function getOposicionScopeDb() {
  return process.env.USE_SELF_HOSTED_POOLER === 'true' ? getPoolerDb() : getDb()
}
import { laws, questions, topicScope, topics, userProfiles, validationErrorLogs } from '@/db/schema'
import { and, eq, gte, inArray, or, sql } from 'drizzle-orm'
import { getValidExamPositions, isExamPositionRegistered } from '@/lib/config/exam-positions'
import { ALL_POSITION_TYPES } from '@/lib/config/oposiciones'
import { logValidationError } from '@/lib/api/validation-error-log'

// Dedupe intra-proceso del aviso "oposición sin mapeo de exam_position":
// 1 entrada por (positionType, YYYY-MM-DD). Evita spam en Vercel y en la
// tabla validation_error_logs. Ver análisis 15/04/2026 (bugs de logs).
const loggedNoMappingToday = new Set<string>()

function recordNoExamPositionMapping(positionType: string) {
  const dayKey = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const cacheKey = `${positionType}|${dayKey}`
  if (loggedNoMappingToday.has(cacheKey)) return
  loggedNoMappingToday.add(cacheKey)

  // Fire-and-forget: no bloquear la respuesta. Dedupe en BD por día +
  // positionType (el dedupe intra-proceso de arriba evita N inserts por
  // request; el SELECT siguiente evita duplicar entre lambdas/dev/prod).
  ;(async () => {
    try {
      const db = getOposicionScopeDb()
      const dayStart = new Date()
      dayStart.setUTCHours(0, 0, 0, 0)
      const existing = await db
        .select({ id: validationErrorLogs.id })
        .from(validationErrorLogs)
        .where(
          and(
            eq(validationErrorLogs.endpoint, 'lib/oposicion-scope'),
            eq(validationErrorLogs.errorType, 'no_exam_position_mapping'),
            eq(validationErrorLogs.severity, 'info'),
            gte(validationErrorLogs.createdAt, dayStart.toISOString()),
            sql`${validationErrorLogs.requestBody}->>'positionType' = ${positionType}`,
          ),
        )
        .limit(1)
      if (existing.length > 0) return

      // Migrado 2026-05-26 a `logValidationError` (Bloque 4 Fase 1) para
      // garantizar espejo a observable_events via _insertLog. Antes este
      // writer escribía directo a validationErrorLogs y NO llegaba al
      // censo de eventos — blind spot detectado en audit.
      logValidationError({
        endpoint: 'lib/oposicion-scope',
        errorType: 'no_exam_position_mapping',
        severity: 'info',
        errorMessage: `Oposición "${positionType}" sin mapeo en EXAM_POSITION_MAP — bloqueando todas las oficiales (comportamiento defensivo). Si empieza a tener oficiales propias, añadir entrada en lib/config/exam-positions.ts.`,
        requestBody: { positionType },
      })
    } catch {
      // La telemetría no debe bloquear ni hacer ruido por sí misma.
    }
  })()
}

export type AllowedLawsResult = {
  positionType: string
  lawIds: string[]
  lawShortNames: string[]
}

type Params = {
  /**
   * Si se pasa, deriva positionType de user_profiles.target_oposicion.
   * Sobrescribe fallbackPositionType cuando la fila existe y tiene valor.
   */
  userId?: string | null
  /** Valor por defecto si no hay userId o el perfil no tiene target_oposicion. */
  fallbackPositionType?: string
}

const DEFAULT_FALLBACK = 'auxiliar_administrativo_estado'

/**
 * Devuelve el positionType efectivo y la lista de law_ids que pertenecen al
 * scope de ese positionType (via topic_scope × topics).
 *
 * Garantías:
 * - Nunca lanza si el usuario no existe — usa fallback.
 * - Si positionType no tiene topic_scope configurado → lawIds: [].
 * - La lista de lawIds es única (distinct).
 */
export async function getAllowedLawIds(
  params: Params = {}
): Promise<AllowedLawsResult> {
  const db = getOposicionScopeDb()
  const fallback = params.fallbackPositionType || DEFAULT_FALLBACK

  let positionType = fallback

  if (params.userId) {
    const profile = await db
      .select({ targetOposicion: userProfiles.targetOposicion })
      .from(userProfiles)
      .where(eq(userProfiles.id, params.userId))
      .limit(1)

    const target = profile[0]?.targetOposicion
    if (target && target.trim().length > 0) {
      positionType = target
    }
  }

  const scopedLaws = await db
    .selectDistinct({
      lawId: topicScope.lawId,
      lawShortName: laws.shortName,
    })
    .from(topicScope)
    .innerJoin(topics, eq(topicScope.topicId, topics.id))
    .innerJoin(laws, eq(topicScope.lawId, laws.id))
    .where(eq(topics.positionType, positionType))

  const lawIds = scopedLaws
    .map((r) => r.lawId)
    .filter((id): id is string => id !== null)
  const lawShortNames = scopedLaws
    .map((r) => r.lawShortName)
    .filter((n): n is string => typeof n === 'string' && n.length > 0)

  return { positionType, lawIds, lawShortNames }
}

// ============================================
// Intersección pura: selectedLaws × scope del positionType
// ============================================
// Usado por isLawOnlyMode para bloquear que un usuario reciba preguntas de
// leyes fuera del scope de su oposición (bug dispute 4e247ddc).

export type FilterSelectedLawsByScopeInput = {
  selectedLaws: string[]
  allowedLawShortNames: string[]
}

export type FilterSelectedLawsByScopeResult = {
  allowedLaws: string[]
  empty: boolean
  emptyReason?: string
}

export function filterSelectedLawsByScope(
  input: FilterSelectedLawsByScopeInput
): FilterSelectedLawsByScopeResult {
  const { selectedLaws, allowedLawShortNames } = input

  if (!allowedLawShortNames || allowedLawShortNames.length === 0) {
    return {
      allowedLaws: [],
      empty: true,
      emptyReason: 'No hay contenido configurado para esta oposición',
    }
  }

  const allowedSet = new Set(allowedLawShortNames)
  const allowedLaws = selectedLaws.filter((name) => allowedSet.has(name))

  if (allowedLaws.length === 0) {
    return {
      allowedLaws: [],
      empty: true,
      emptyReason:
        'Las leyes seleccionadas no pertenecen al temario de tu oposición',
    }
  }

  return { allowedLaws, empty: false }
}

// ============================================
// Filtro de preguntas oficiales por exam_position
// ============================================
// Bug histórico (Laura Abellan, 14/04/2026): preguntas oficiales con
// exam_position de OTRA oposición se colaban en tests "practice" porque el
// filtro exam_position SOLO se aplicaba en modo onlyOfficialQuestions=true.
// Las oficiales vinculadas a leyes estatales (TREBEP, L39, L40, CE...) son
// elegibles desde el scope, por lo que sin este filtro contaminan tests
// de cualquier oposición que comparta esas leyes.
//
// Este helper devuelve una cláusula Drizzle que SIEMPRE permite preguntas
// no oficiales y solo permite oficiales si su exam_position está mapeada al
// positionType del usuario. Aplicarlo en TODA query que sirva preguntas.

/**
 * Comportamiento (post-15/04/2026, caso Laura):
 *
 * - Oposición CON mapeo en exam-positions.ts: admite oficiales solo si su
 *   exam_position está en la lista permitida.
 * - Oposición SIN mapeo: BLOQUEA todas las oficiales (no admite ninguna).
 *   Más seguro porque hoy en BD solo hay oficiales de 8 cuerpos (estado,
 *   madrid, cyl, andalucia, tramitación, auxilio, administrativo,
 *   gestion_admin_civil). Cualquier oficial que aparezca a una oposición
 *   sin mapeo es necesariamente cross-contaminación.
 *
 * Emite warn para que se detecte y se añada el mapeo si la oposición
 * empezara a tener oficiales propias en el futuro.
 */
export function buildOfficialExamFilter(positionType: string) {
  const validPositions = getValidExamPositions(positionType)
  if (!validPositions || validPositions.length === 0) {
    // Si está REGISTRADA en EXAM_POSITION_MAP (aunque con array vacío),
    // es caso conocido — silenciar warn. Si NO está registrada, log info
    // para que el equipo añada la entrada cuando importe oficiales.
    if (isExamPositionRegistered(positionType)) {
      // Caso conocido: oposición existe pero sin oficiales todavía.
      // No-op (sin log) — añadir entradas a EXAM_POSITION_MAP cuando se
      // importen preguntas oficiales para esta oposición.
    } else if (ALL_POSITION_TYPES.includes(positionType)) {
      // Oposición conocida pero sin mapeo todavía. Registrar 1 vez al día en
      // validation_error_logs (severity=info) para trazabilidad en admin sin
      // spam de logs. Ver análisis 15/04/2026.
      recordNoExamPositionMapping(positionType)
    } else {
      // positionType inesperado (no está en OPOSICIONES). Bug real: warn inmediato.
      console.warn(
        `[scope] sin mapeo exam_position para "${positionType}" (positionType no reconocido) — ` +
        `bloqueando todas las oficiales. Revisa el origen del positionType.`
      )
    }
    return eq(questions.isOfficialExam, false)
  }
  return or(
    eq(questions.isOfficialExam, false),
    and(
      eq(questions.isOfficialExam, true),
      inArray(questions.examPosition, validPositions),
    ),
  )
}

/**
 * Versión JS de {@link buildOfficialExamFilter} para CONTAR sobre filas ya
 * cargadas en memoria (no queries SQL). MISMA semántica y MISMA fuente
 * (`getValidExamPositions`): una pregunta cuenta como oficial de `positionType`
 * solo si es oficial Y su `examPosition` está en el mapeo de la oposición.
 * Oposición sin posiciones válidas → ninguna oficial cuenta.
 *
 * FUENTE ÚNICA: todo conteo de "oficiales de esta oposición" (label del
 * configurador, agregados de tema, etc.) debe pasar por aquí o por
 * `buildOfficialExamFilter`. NUNCA un `filter(q => q.isOfficialExam)` a pelo:
 * ese atajo, sin filtrar por exam_position, fue el bug del label "115" en
 * Seg. Social T3 (07/06/2026) — contaba oficiales de otras oposiciones sobre
 * leyes compartidas (CE, LOTC…). El guard `officialCountSingleSource.test.ts`
 * vigila que no reaparezca.
 *
 * Devuelve un predicado con las posiciones válidas ya resueltas (1 sola lectura
 * del mapa, no por fila).
 */
export function ownOfficialPredicate(
  positionType: string,
): (q: { isOfficialExam?: boolean | null; examPosition?: string | null }) => boolean {
  const valid = new Set(getValidExamPositions(positionType))
  return (q) =>
    q.isOfficialExam === true && q.examPosition != null && valid.has(q.examPosition)
}

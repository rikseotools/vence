// lib/api/oposicion-scope/queries.ts
// Helper centralizado para derivar qué leyes son válidas (scope) para un usuario/oposición.
// Fuente de verdad: topic_scope × topics.position_type.
//
// Usarlo en TODO endpoint que filtre preguntas por oposición para evitar bugs
// cross-oposición tipo dispute 4e247ddc (Mar Aux Estado recibiendo contenido CyL).
//
// Ver project_oposicion_scope_refactor.md para contexto y fases.

import { getDb } from '@/db/client'
import { laws, questions, topicScope, topics, userProfiles } from '@/db/schema'
import { and, eq, inArray, or, sql } from 'drizzle-orm'
import { getValidExamPositions } from '@/lib/config/exam-positions'

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
  const db = getDb()
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
    console.warn(
      `[scope] sin mapeo exam_position para "${positionType}" — bloqueando todas las oficiales. ` +
      `Si esta oposición empieza a tener oficiales propias, añadir entrada en lib/config/exam-positions.ts.`
    )
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

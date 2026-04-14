// lib/api/oposicion-scope/queries.ts
// Helper centralizado para derivar qué leyes son válidas (scope) para un usuario/oposición.
// Fuente de verdad: topic_scope × topics.position_type.
//
// Usarlo en TODO endpoint que filtre preguntas por oposición para evitar bugs
// cross-oposición tipo dispute 4e247ddc (Mar Aux Estado recibiendo contenido CyL).
//
// Ver project_oposicion_scope_refactor.md para contexto y fases.

import { getDb } from '@/db/client'
import { laws, topicScope, topics, userProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'

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

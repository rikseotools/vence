// lib/api/auth/extract-oposicion.ts
// Extractor de target_oposicion desde la URL de registro (returnUrl).
//
// Motivación: hay usuarios que se registran tras navegar contenido de una
// oposición concreta (ej: returnUrl=/auxiliar-administrativo-valencia/temario)
// pero el cliente no siempre pasa `?oposicion=...` explícito al callback.
// Si además no completan el onboarding, quedan con target_oposicion=NULL y
// ven la oposición default (Estado), rompiendo su experiencia.
//
// Este helper aplica fallback server-side: si el caller no pasó `oposicion`
// pero hay una returnUrl con un slug conocido del catálogo, la asignamos.
//
// Principios:
// - Fuente de verdad: OPOSICIONES de lib/config/oposiciones.ts
// - Solo asignar si hay certeza ALTA (slug en primer segmento o ?utm_oposicion)
// - Ante duda → null (mejor NULL que WRONG; el onboarding siempre puede completarlo)
// - Puro TS, sin BD, sin side effects → trivial de testear

import { OPOSICIONES } from '@/lib/config/oposiciones'

const SLUG_TO_POSITION_TYPE = new Map<string, string>(
  OPOSICIONES.map(o => [o.slug, o.positionType])
)
const VALID_POSITION_TYPES = new Set(OPOSICIONES.map(o => o.positionType))

export type ExtractResult = {
  positionType: string | null
  reason:
    | 'no_url'
    | 'slug_in_path'
    | 'utm_param'
    | 'ambiguous_or_unmappable'
    | 'url_parse_error'
}

/**
 * Extrae el target_oposicion (positionType) de una URL de registro/return.
 *
 * Prioridades (solo asigna si hay certeza):
 *   1. Primer segmento del path = slug del catálogo   → slug_in_path
 *   2. ?utm_oposicion=<positionType> | ?opo=<positionType> → utm_param
 *   3. Resto (/leyes/..., /, /soporte...)              → null
 */
export function extractOposicionFromUrl(
  url: string | null | undefined
): ExtractResult {
  if (!url) return { positionType: null, reason: 'no_url' }

  // Normalizar: aceptar tanto paths relativos como URLs absolutas
  let pathname: string
  let searchParams: URLSearchParams
  try {
    const u = new URL(url, 'https://vence.es')
    pathname = u.pathname
    searchParams = u.searchParams
  } catch {
    return { positionType: null, reason: 'url_parse_error' }
  }

  // 1. Primer segmento del path
  const firstSegment = pathname.split('/').filter(Boolean)[0]
  if (firstSegment && SLUG_TO_POSITION_TYPE.has(firstSegment)) {
    return {
      positionType: SLUG_TO_POSITION_TYPE.get(firstSegment)!,
      reason: 'slug_in_path',
    }
  }

  // 2. UTM params
  const utmCandidate =
    searchParams.get('utm_oposicion') || searchParams.get('opo')
  if (utmCandidate && VALID_POSITION_TYPES.has(utmCandidate)) {
    return { positionType: utmCandidate, reason: 'utm_param' }
  }

  return { positionType: null, reason: 'ambiguous_or_unmappable' }
}

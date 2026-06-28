// lib/oposicion/decideLoad.ts
// Helper PURO (sin React/'use client') para decidir qué hacer con la respuesta
// del fetch de la oposición objetivo en OposicionContext. Extraído para poder
// testear el INVARIANTE crítico sin montar un render harness (OposicionContext
// es 'use client' y rompe jest si se importa en un test puro).
//
// INVARIANTE (fix bug Nila, heavy user móvil): el endpoint
// GET /api/v2/oposicion/target SIEMPRE devuelve 200 con target_oposicion:null
// para un usuario sin oposición (ver __tests__/api/v2/oposicionTarget.test.ts).
// Por tanto un no-2xx (401 por race del token al reanudar en móvil, 5xx por
// saturación) NO significa "sin oposición" → NUNCA se debe borrar la oposición
// conocida ante un fallo transitorio (eso rompía tests en curso y mostraba
// "Selecciona tu oposición" en falso).

export type OposicionLoadAction =
  | 'keep' // fetch falló (401/5xx/red): mantener el estado actual, NO nullear
  | 'clear' // 200 OK + sin oposición: el usuario genuinamente no tiene oposición
  | 'invalid' // 200 OK + oposición con dato sucio (UUID/JSON/slug desconocido)
  | 'set' // 200 OK + oposición válida

/**
 * Decide la acción a partir de la respuesta del fetch.
 * @param resOk          response.ok del fetch (false = 401/5xx/red transitorio)
 * @param targetOposicion target_oposicion del body (solo fiable si resOk)
 * @param isValidOposicion si targetOposicion está en ALL_OPOSICION_IDS
 */
export function decideOposicionLoad(
  resOk: boolean,
  targetOposicion: string | null | undefined,
  isValidOposicion: boolean,
): OposicionLoadAction {
  if (!resOk) return 'keep'
  if (!targetOposicion) return 'clear'
  return isValidOposicion ? 'set' : 'invalid'
}

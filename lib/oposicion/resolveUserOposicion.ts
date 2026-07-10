// lib/oposicion/resolveUserOposicion.ts
// Identidad de la oposición del usuario, AGNÓSTICA al blob denormalizado
// `target_oposicion_data`. Motivo: 428 perfiles (10/07/2026) tienen
// `target_oposicion` puesto pero `target_oposicion_data` NULL (write path parcial
// en onboarding/save-field). Si la UI deriva "tiene oposición" del blob, a esos
// usuarios les sale el selector "elige oposición" en las páginas de test aunque SÍ
// la tengan. Fuente de verdad = `oposicionId` (validado) + nombre del config; el
// blob solo enriquece el nombre si viene.
//
// Helpers PUROS (unit-testables sin React/BD), al estilo de `decideLoad`.

export interface OposicionIdentity {
  id: string
  name: string
}

/**
 * Extrae un id de oposición (string) de un `detail` de evento que puede venir
 * como string (id) o como objeto `{ id, ... }`. El `OposicionDetector` despacha
 * `oposicionAssigned` con `{ oposicion: <objeto> }`, así que sin esto el handler
 * recibía un OBJETO donde esperaba un id → `ALL_OPOSICION_IDS.includes(objeto)`
 * = false → nuleaba la oposición del usuario recién asignado.
 */
export function extractOposicionId(raw: unknown): string | null {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') {
    const id = (raw as { id?: unknown }).id
    if (typeof id === 'string') return id
  }
  return null
}

/**
 * Identidad de la oposición para el contexto. Devuelve null solo si NO hay
 * oposición (opoId falsy). Con opoId presente, SIEMPRE devuelve una identidad
 * con nombre (blob → config → genérico), nunca null por culpa del blob NULL.
 */
export function resolveUserOposicion(
  opoId: string | null | undefined,
  configName: string | null | undefined,
  blob?: { name?: string | null } | null,
): OposicionIdentity | null {
  if (!opoId) return null
  const name = (blob?.name || configName || 'Tu oposición') as string
  return { id: opoId, name }
}

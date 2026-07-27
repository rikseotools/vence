// lib/storage/safeLocalStorage.ts — acceso a localStorage que NUNCA tumba la interfaz.
//
// Nace de un fallo medido (27/07/2026): 19 `react_error_boundary` en 24 horas con
// «Failed to execute 'setItem' on 'Storage': Setting the value of 'vence_hw_fingerprint' exceeded
// the quota». El fingerprint es un hash de ~10 caracteres: no llena nada. Lo que pasa es que el
// localStorage del usuario YA está lleno, y `setItem` **lanza**. Como esa llamada estaba desnuda en
// `lib/deviceFingerprint.ts`, la excepción subía y rompía el árbol de React: pantalla rota por no
// poder guardar una caché opcional.
//
// El mismo tropiezo estaba ya parcheado A MANO en `utils/testBackup.ts` y `utils/answerSaveQueue.ts`
// (los dos comprueban `QuotaExceededError` por su cuenta). Tres parches y ningún sitio común: esto
// es ese sitio.
//
// Reglas de la casa:
//   1. Leer o escribir una preferencia NUNCA debe romper la app. Si el navegador dice que no, se sigue.
//   2. El fallo no se traga en silencio: se emite como observabilidad para poder verlo.
//   3. Sin dependencias del DOM en el módulo: es seguro importarlo desde código que corre en servidor.
//
// Casos reales en que `localStorage` lanza, más allá de la cuota: Safari en navegación privada, iframes
// de terceros, y navegadores con cookies bloqueadas — donde hasta *leer* revienta.

import { emitClientEvent } from '@/lib/observability/client'

/** Cuántos avisos por clave se emiten como máximo, para no inundar la observabilidad. */
const MAX_AVISOS_POR_CLAVE = 1
const avisados = new Set<string>()

function disponible(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function avisar(key: string, op: 'get' | 'set' | 'remove', e: unknown): void {
  const nombre = e instanceof Error ? e.name : 'UnknownError'
  const cuota = nombre === 'QuotaExceededError' ||
    (e instanceof Error && /exceeded the quota|QuotaExceeded/i.test(e.message))

  const marca = `${key}:${op}`
  if (avisados.size < 200 && !avisados.has(marca)) {
    avisados.add(marca)
    if (avisados.size <= MAX_AVISOS_POR_CLAVE * 200) {
      try {
        emitClientEvent({
          // `warn`, no `error`: la app sigue funcionando. Marcarlo como error dispararía la alerta de
          // pico de errores de cliente por algo que ya está contenido — el mismo criterio que
          // `usage_limit_hit`. Lo que NO se puede es dejar de verlo: la cuota llena degrada la
          // experiencia (se pierden backups de test, colas de respuestas) aunque no rompa.
          severity: 'warn',
          eventType: 'custom',
          errorMessage: `localStorage.${op} falló para «${key}»: ${nombre}`,
          metadata: { key, op, quotaExceeded: cuota, kind: 'storage_unavailable' },
        })
      } catch {
        // Ni la observabilidad puede romper esto.
      }
    }
  }
}

/** Lee una clave. Devuelve `null` si no se puede leer, por el motivo que sea. */
export function safeGet(key: string): string | null {
  if (!disponible()) return null
  try {
    return window.localStorage.getItem(key)
  } catch (e) {
    avisar(key, 'get', e)
    return null
  }
}

/**
 * Escribe una clave. Devuelve `true` si se guardó de verdad.
 * El llamante decide si le importa; lo que no pasa nunca es que esto lance.
 */
export function safeSet(key: string, value: string): boolean {
  if (!disponible()) return false
  try {
    window.localStorage.setItem(key, value)
    return true
  } catch (e) {
    avisar(key, 'set', e)
    return false
  }
}

/** Borra una clave. `true` si se pudo. */
export function safeRemove(key: string): boolean {
  if (!disponible()) return false
  try {
    window.localStorage.removeItem(key)
    return true
  } catch (e) {
    avisar(key, 'remove', e)
    return false
  }
}

/** Solo para tests: olvida qué claves ya avisaron. */
export function _resetAvisos(): void {
  avisados.clear()
}

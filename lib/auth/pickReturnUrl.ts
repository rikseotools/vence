// lib/auth/pickReturnUrl.ts
// Decisión PURA de a dónde redirigir tras autenticarse (extraída de
// app/auth/callback/page.tsx para poder simularla a fondo). Prioridad:
//   1. `return_to` (query param): a dónde iba el usuario (p.ej. seguir un test).
//   2. Backup en localStorage (`auth_return_url_backup`) si es fresco (< 10 min).
//   3. Destino neutro '/' (home) — NUNCA forzar la oposición flagship (Estado).
// La I/O de localStorage (leer/remove) vive en el componente; aquí solo se DECIDE.

export const RETURN_BACKUP_MAX_AGE_MS = 10 * 60 * 1000 // 10 minutos
export const NEUTRAL_DEFAULT_URL = '/'

export interface ReturnUrlDecision {
  /** URL final a la que redirigir */
  url: string
  /** true si hay que limpiar el backup de localStorage (fresco consumido o stale) */
  consumeBackup: boolean
}

export function pickReturnUrl(
  returnToParam: string | null | undefined,
  backupUrl: string | null | undefined,
  backupTimestamp: string | null | undefined,
  nowMs: number,
): ReturnUrlDecision {
  // 1. return_to gana siempre (donde estaba el usuario)
  if (returnToParam) {
    return { url: returnToParam, consumeBackup: false }
  }

  // 2. backup de localStorage, si es fresco
  if (backupUrl && backupTimestamp) {
    const parsed = parseInt(backupTimestamp, 10)
    const age = Number.isFinite(parsed) ? nowMs - parsed : Infinity
    if (age < RETURN_BACKUP_MAX_AGE_MS) {
      return { url: backupUrl, consumeBackup: true } // fresco → usar + limpiar
    }
    return { url: NEUTRAL_DEFAULT_URL, consumeBackup: true } // stale → limpiar + default
  }

  // 3. sin contexto → destino neutro (NO Estado)
  return { url: NEUTRAL_DEFAULT_URL, consumeBackup: false }
}

// lib/db/safeServerFetch.ts
// Helper para SSR pages: ejecuta una query con quick-fail timeout, y en caso
// de timeout devuelve null (en lugar de propagar). Evita que server components
// queden colgados a 300s cuando hay blip del pooler.
//
// Uso:
//   const data = await safeServerFetch(() => getDataCached(slug), 8000, 'landing-data')
//   // data es null si la query timeoutea; el caller debe tener fallback razonable.

import { withDbTimeout, isDbTimeoutError } from '@/lib/db/timeout'

/**
 * Envuelve un fetch en SSR pages con timeout. Devuelve null si timeout
 * (NO propaga error). Si hay error no-timeout, devuelve null y loguea.
 */
export async function safeServerFetch<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  label = 'unknown',
): Promise<T | null> {
  try {
    return await withDbTimeout(fn, timeoutMs)
  } catch (err) {
    if (isDbTimeoutError(err)) {
      console.warn(`⏱️ [SSR/${label}] Timeout (quick-fail): ${err.timeoutMs}ms`)
      return null
    }
    // Errores no-timeout: loguear y devolver null para no romper la page
    console.error(`❌ [SSR/${label}] Error:`, err)
    return null
  }
}

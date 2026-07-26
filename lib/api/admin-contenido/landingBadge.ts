// lib/api/admin-contenido/landingBadge.ts
//
// Helper PURO (sin deps de servidor) para el badge de "salud de la landing" en /admin/contenido:
// cuántos hallazgos VIVOS tiene la página que ve el opositor de esa oposición, en su propia fila.
//
// Por qué vive en la fila y no en otro panel (T-142): los seis defectos de la landing de
// `policia-nacional` —con el plazo de solicitudes abierto— se descubrieron al ir a mandarle una
// newsletter, no por el sistema. Parte del problema era de sitio: la salud de contenido estaba en
// `/admin/salud-sistema` y el trabajo por oposición en `/admin/contenido`, así que había que saber
// en qué panel mirar. Aquí se ve junto al resto de indicadores de esa oposición, con la frase que
// se le dice a Claude, como el resto de hallazgos.
//
// Vive aparte de queries.ts porque lo consumen query, UI y test (mismo patrón que coverageBadge).

export type LandingTone = 'ok' | 'warn' | 'error'

export interface LandingCounts {
  landing_errores: number
  landing_avisos: number
}

/** Frase-gatillo del runbook para auditar la landing entera (registro: runbookRegistry). */
export const LANDING_TRIGGER = 'audita la landing'

/**
 * Estado de la landing de una oposición.
 *   - ok    (✓): sin hallazgos de landing.
 *   - warn  (N⚠): solo avisos (SEO, completitud mejorable…).
 *   - error (N✕): algo que el opositor VE mal (enlace que miente, tarjeta incoherente…).
 */
export function landingBadge(row: LandingCounts): { tone: LandingTone; label: string; title: string } {
  const err = row.landing_errores || 0
  const warn = row.landing_avisos || 0
  if (err > 0) {
    return {
      tone: 'error',
      label: `${err} ✕`,
      title:
        `${err} defecto(s) que el opositor VE en la landing` +
        (warn ? ` (+${warn} aviso(s))` : '') +
        ` — audítala entera: npm run audit:landing -- <slug>`,
    }
  }
  if (warn > 0) {
    return {
      tone: 'warn',
      label: `${warn} ⚠`,
      title: `${warn} aviso(s) en la landing (no engañan al opositor, pero conviene cerrarlos)`,
    }
  }
  return { tone: 'ok', label: '✓', title: 'Landing sin hallazgos en el último barrido' }
}

export const LANDING_TONE_CLS: Record<LandingTone, string> = {
  ok: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
  warn: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  error: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
}

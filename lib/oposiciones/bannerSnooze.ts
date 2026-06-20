// lib/oposiciones/bannerSnooze.ts
//
// Cooldown del banner global "Inscripción abierta" — anti-martilleo (20/06).
//
// Problema: al cerrar (✕) una convocatoria, el banner mostraba la SIGUIENTE al
// instante, y otra, y otra → martilleo. La ✕ debe significar "déjame en paz un
// rato", no "pasa a la siguiente ya".
//
// Solución: tras CUALQUIER cierre, silencio global durante BANNER_COOLDOWN_HOURS.
// La fuente de verdad del "último cierre" es account-level (server: MAX(dismissed_at)
// de user_inscription_banner_dismissals) para que el silencio sea cross-device en
// usuarios logueados — NO solo localStorage, que se perdería al cambiar de dispositivo.
// Anónimos: localStorage (mejor esfuerzo; no hay cuenta que sincronizar).
// Funciones PURAS para poder testearlas sin DOM ni red.

export const BANNER_COOLDOWN_HOURS = 24

/** El más reciente de dos timestamps ISO (o null). Comparación lexicográfica = cronológica. */
export function latestDismiss(a: string | null, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  return a > b ? a : b
}

/**
 * ¿El banner está en cooldown (silenciado) ahora mismo?
 * true si el último cierre fue hace menos de `cooldownHours`. Sin último cierre → no.
 * Timestamp inválido → no silencia (fail-open: mejor mostrar que ocultar por un dato malo).
 */
export function isBannerSnoozed(
  lastDismissIso: string | null,
  nowMs: number,
  cooldownHours: number = BANNER_COOLDOWN_HOURS,
): boolean {
  if (!lastDismissIso) return false
  const t = Date.parse(lastDismissIso)
  if (Number.isNaN(t)) return false
  return nowMs - t < cooldownHours * 3_600_000
}

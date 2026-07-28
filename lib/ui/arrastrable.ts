/**
 * Arrastre de elementos flotantes: parte pura (sin DOM ni `window`).
 *
 * Vivía dentro de `components/DailyGoalBanner.tsx` (`clampBannerOffset`). Al necesitar lo
 * mismo para los controles del examen se sube aquí para que haya UNA implementación: el
 * banner la sigue exportando con su nombre de antes, pero delega en esta.
 */

export interface ArgsClamp {
  /** Posición natural (la que tendría sin desplazar), en coordenadas de viewport. */
  naturalLeft: number
  naturalTop: number
  /** Desplazamiento acumulado antes de este gesto. */
  baseX: number
  baseY: number
  /** Movimiento del gesto en curso. */
  dx: number
  dy: number
  width: number
  height: number
  viewportWidth: number
  viewportHeight: number
  margin?: number
}

/**
 * Clampea el desplazamiento para que el elemento NUNCA se pierda fuera del viewport (queda
 * siempre entero, con margen). Devuelve el offset relativo a la posición natural.
 */
export function clampOffsetArrastre(args: ArgsClamp): { x: number; y: number } {
  const m = args.margin ?? 4
  let absLeft = args.naturalLeft + args.baseX + args.dx
  let absTop = args.naturalTop + args.baseY + args.dy
  absLeft = Math.min(Math.max(absLeft, m), args.viewportWidth - args.width - m)
  absTop = Math.min(Math.max(absTop, m), args.viewportHeight - args.height - m)
  return {
    x: Math.round(absLeft - args.naturalLeft),
    y: Math.round(absTop - args.naturalTop),
  }
}

export interface ArgsClampAbsoluto {
  left: number
  top: number
  width: number
  height: number
  viewportWidth: number
  viewportHeight: number
  margin?: number
}

/**
 * Clampea una posición ABSOLUTA de viewport (la que se guarda de verdad).
 *
 * Se guarda absoluta y no como desplazamiento respecto a la posición "natural" porque esa
 * natural se mueve: cuelga de la cabecera, que mide distinto según sesión, ancho y avisos.
 * Guardando el desplazamiento, al recargar se aplicaba sobre otra base y el control aparecía
 * en un sitio distinto del que el usuario lo dejó (fallo observado en la verificación).
 */
export function clampPosAbsoluta(args: ArgsClampAbsoluto): { left: number; top: number } {
  const m = args.margin ?? 4
  const maxLeft = Math.max(m, args.viewportWidth - args.width - m)
  const maxTop = Math.max(m, args.viewportHeight - args.height - m)
  return {
    left: Math.round(Math.min(Math.max(args.left, m), maxLeft)),
    top: Math.round(Math.min(Math.max(args.top, m), maxTop)),
  }
}

/**
 * ¿El gesto es un ARRASTRE o un simple toque? Sin umbral, cualquier micro-temblor del dedo
 * convertiría un toque en arrastre y el control dejaría de responder al clic.
 */
export const UMBRAL_ARRASTRE_PX = 6

export function esArrastre(dx: number, dy: number, umbral = UMBRAL_ARRASTRE_PX): boolean {
  return Math.hypot(dx, dy) >= umbral
}

/** Lee una posición absoluta persistida. Tolera basura en localStorage sin romper el render. */
export function parsearPosAbsoluta(raw: string | null | undefined): { left: number; top: number } | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw)
    if (typeof v?.left === 'number' && typeof v?.top === 'number' && Number.isFinite(v.left) && Number.isFinite(v.top)) {
      return { left: v.left, top: v.top }
    }
  } catch { /* basura → posición por defecto */ }
  return null
}

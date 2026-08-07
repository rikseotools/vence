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

/**
 * A partir de qué desplazamiento vertical una posición guardada deja de parecer una colocación
 * y pasa a ser el rastro de un SCROLL capturado por error.
 *
 * No es un número a ojo: medido sobre `daily_goal_banner_action` (30 días, 129 arrastres de 22
 * usuarios), **59 de 129 arrastres (11 usuarios) superan los 200 px** de desplazamiento
 * vertical, con casos de 707, 948 y 1.433 px. Nadie coloca una pastilla de 24 px de alto
 * arrastrándola 1.433 px: eso es un dedo haciendo scroll sobre ella. Por debajo de ese corte
 * se respeta lo que el usuario hizo — mover algo de sitio es su derecho.
 */
export const DESPLAZAMIENTO_SOSPECHOSO_PX = 200

/**
 * ¿Esta posición guardada hay que RESCATARLA (devolver el elemento a su sitio)?
 *
 * Nace del caso de Sara (feedback `247449ed`, 07/08/2026): la barra de meta diaria llevaba
 * `touch-action: none`, así que un dedo que empezaba el scroll encima de ella no hacía scroll,
 * la ARRASTRABA. Y donde quedaba se quedaba, con `z-index: 50`, flotando sobre el contenido:
 * lo que hubiera debajo dejaba de recibir toques. Ella lo reportó como dos fallos distintos
 * («se me movía por la pantalla» y «le doy y no se abre»), y era el mismo.
 *
 * El asa de arrastre impide que vuelva a pasar; esto rescata a quien YA la tiene descolocada,
 * **sin pedirle nada**: si tuviera que ir a su perfil a arreglarlo, le estaríamos pidiendo el
 * esfuerzo justo a quien peor lo tiene (puede tener la barra encima del propio control).
 */
export function necesitaRescate(
  pos: { x: number; y: number } | null | undefined,
  umbral = DESPLAZAMIENTO_SOSPECHOSO_PX,
): boolean {
  if (!pos) return false
  return Math.abs(pos.y) > umbral
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

/**
 * A qué altura debe quedarse pegado un elemento `sticky` para NO acabar debajo de la
 * cabecera del sitio.
 *
 * Nace de un fallo real (feedback Manolo, 28/07/2026): la barra del examen se pegaba con
 * `top-0` y `z-30`, pero la cabecera es `sticky top-0 z-50` y mide ~105 px. Resultado: la
 * barra SÍ se quedaba pegada… detrás de la cabecera. Invisible y, peor, INCLICABLE — los
 * clics del usuario aterrizaban en la cabecera. Los dos síntomas que reportó ("el reloj no
 * baja" y "el botón no funciona") eran el mismo bug.
 *
 * La altura de la cabecera NO es una constante que se pueda escribir a mano: cambia con el
 * ancho (móvil/escritorio), con el aviso de convocatoria y con la segunda fila que solo
 * aparece si hay sesión. Por eso se mide en vivo; aquí vive la parte pura y testeable.
 */

export interface RectLike {
  top: number
  bottom: number
}

export interface OpcionesOffset {
  /** Alto de la ventana, para no dejar la barra ocupando media pantalla si algo se desmadra. */
  altoViewport?: number
  /** Fracción máxima del viewport que puede consumir el desplazamiento (defensa). */
  maxFraccion?: number
}

const MAX_FRACCION_POR_DEFECTO = 0.35

/**
 * Devuelve los píxeles que hay que dejar libres por arriba.
 *
 * @param cabecera       Rect de la cabecera pegajosa (o `null` si no hay).
 * @param sobresalientes Rects de hijos posicionados que asoman POR DEBAJO de la cabecera
 *                       (la segunda fila móvil de racha/leyes es `absolute top-full`, así que
 *                       cae fuera de la caja de la cabecera y taparía igual).
 */
export function offsetBajoCabecera(
  cabecera: RectLike | null | undefined,
  sobresalientes: RectLike[] = [],
  opts: OpcionesOffset = {},
): number {
  if (!cabecera) return 0

  // Solo estorba lo que está pegado arriba. Una cabecera que ya se fue hacia arriba con el
  // scroll (no pegajosa) no tapa nada, y sumar su alto dejaría un hueco absurdo.
  if (!Number.isFinite(cabecera.bottom) || cabecera.bottom <= 0) return 0

  let borde = cabecera.bottom
  for (const r of sobresalientes) {
    if (r && Number.isFinite(r.bottom) && r.bottom > borde) borde = r.bottom
  }

  const alto = opts.altoViewport
  const fraccion = opts.maxFraccion ?? MAX_FRACCION_POR_DEFECTO
  if (Number.isFinite(alto) && (alto as number) > 0) {
    borde = Math.min(borde, (alto as number) * fraccion)
  }

  return Math.max(0, Math.round(borde))
}

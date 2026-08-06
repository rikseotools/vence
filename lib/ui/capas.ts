/**
 * Qué va por encima de qué (z-index), en un solo sitio.
 *
 * Nace de un fallo real (feedback Laura Simar, 06/08/2026, [T-608]): el modal de «solo preguntas
 * falladas» se pintaba entero en el móvil… y **el cuarto inferior no se podía tocar**, porque el
 * banner de cookies vive en `fixed bottom-0 z-[9999]` y el modal en `z-50`. Los toques de esa
 * franja los recibía el banner. Medido en producción con su sesión (iPhone 13, 390×664): tocar la
 * opción de orden en `y=583` activaba «Personalizar» del banner, y como sin elegir orden el botón
 * de empezar ni se renderiza, el test no había forma de lanzarlo.
 *
 * **Por qué hacía falta una escala y no otro parche.** Ese remedio ya se había aplicado dos veces a
 * mano —`ArticleModal` y `AvatarChanger` escalaron por su cuenta a `z-[9999]`— y quedaban **41
 * ficheros** con modales en `z-50` con el mismo agujero. Escalar de uno en uno es una guerra de
 * números mágicos donde gana el último que llega y nadie sabe por qué.
 *
 * Es hermano de `stickyOffset` (misma familia de fallo: algo que se ve pero no se puede pulsar
 * porque otra capa se lleva los clics).
 *
 * **Se aplica con `style={{ zIndex: CAPAS.x }}`, no con una clase de Tailwind construida al vuelo:**
 * Tailwind solo genera los valores arbitrarios (`z-[10000]`) que encuentra LITERALES en el código,
 * así que una clase compuesta en tiempo de ejecución no existiría en el CSS y la capa no se
 * aplicaría. `ArticleModal` ya lo hace así.
 */

export const CAPAS = {
  /** Contenido normal de la página. */
  contenido: 0,
  /** Cabecera y barras pegajosas. Conviven con el contenido, mandan sobre él. */
  cabecera: 50,
  /**
   * Aviso legal (banner de cookies). Por encima del contenido a propósito: tiene que verse.
   * Ojo: NO por encima de un modal — ver abajo.
   */
  avisoLegal: 9999,
  /**
   * Un modal BLOQUEA la interacción: mientras está abierto es lo único con lo que se puede
   * interactuar, así que va por encima incluso del aviso legal. El aviso no desaparece —
   * vuelve a estar ahí en cuanto el modal se cierra—, simplemente deja de robarle los toques.
   */
  modal: 10000,
  /**
   * Avisos del propio sistema que tienen que verse SIEMPRE, incluso sobre un modal: la franja
   * roja de suplantación es el caso (saber en la cuenta de quién estás no es negociable).
   */
  sistema: 10050,
} as const

export type NombreCapa = keyof typeof CAPAS

/**
 * ¿Puede la capa `encima` recibir los toques que caen sobre `debajo`?
 *
 * Función pura, para poder fijar en un test las relaciones que importan sin depender de que
 * alguien vuelva a abrir un navegador. Con z-index iguales gana el orden del DOM, que es
 * justo la clase de azar que este módulo existe para evitar: por eso «igual» cuenta como NO.
 */
export function tapaA(encima: NombreCapa, debajo: NombreCapa): boolean {
  return CAPAS[encima] > CAPAS[debajo]
}

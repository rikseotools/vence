/**
 * lib/ui/navOverflow.ts — cuántos enlaces de la cabecera caben en la barra, y qué se hace
 * con los que no caben.
 *
 * ## Por qué existe (T-504, 03/08/2026)
 *
 * La cabecera de escritorio venía creciendo un enlace cada vez —Teoría Legal, Test
 * combinando leyes, Oposición personalizada, Preguntas guardadas, Recompensas— sin que nada
 * comprobara que seguía cabiendo. El 03/08 dejó de caber: medido contra producción con
 * navegador real, la fila ocupaba **1.879 px** dentro de un contenedor que da **1.504 px**
 * como máximo, así que **el avatar y la campana quedaban fuera de la pantalla** en TODAS las
 * anchuras de escritorio (1280, 1440, 1536 y 1920) y en los dos planes. Y como `html` y
 * `body` llevan `overflow-x: hidden`, no había scroll con el que alcanzarlos: eran
 * inaccesibles. Lo reportó un usuario recién hecho premium, que fue quien cruzó el umbral
 * (el octavo enlace), no quien lo causó.
 *
 * **El contenedor no puede crecer**: `container` de Tailwind topa en 1536 px, así que ni en
 * una pantalla de 2560 px cabría. No es un problema de breakpoint — no hay anchura que lo
 * arregle. Por eso la barra tiene que decidir qué enseña.
 *
 * ## Lo que decide este módulo
 *
 * Reparto «priority+»: los enlaces que caben se quedan en la barra y **el resto van a un
 * menú «Más»**, nunca a ninguna parte. Es la propiedad que hacía falta: da igual cuántos
 * enlaces se añadan mañana, el sobrante se pliega en vez de empujar al avatar fuera.
 *
 * PURO: no toca el DOM ni React. Recibe anchos ya medidos y devuelve un reparto. Quien mide
 * es el componente; así el criterio se puede probar sin navegador.
 */

export interface RepartoNav {
  /** Cuántos enlaces (de los primeros) se pintan en la barra. */
  visibles: number
  /** Cuántos se van al menú «Más». 0 = no hace falta el botón. */
  ocultos: number
  /**
   * `false` cuando las medidas todavía no son fiables (primer render, anchos a cero). En ese
   * caso `visibles` son TODOS: se pinta el menú completo y quien evita el desastre es la
   * garantía de CSS (`min-w-0` + scroll en la píldora), no este cálculo. Se falla hacia
   * ENSEÑAR: un menú que se corta molesta, uno que desaparece deja al usuario sin sitios a
   * los que ir.
   */
  medido: boolean
}

export interface EntradaRepartoNav {
  /** Ancho de cada enlace en px, en el orden en que se pintan. */
  anchosItems: number[]
  /** Ancho que la barra puede ocupar sin empujar a nadie (el `clientWidth` del `<nav>`). */
  anchoDisponible: number
  /** Lo que ocupa el botón «Más». */
  anchoBotonMas: number
  /** Separación entre enlaces (`space-x-1` = 4 px). */
  huecoEntreItems?: number
  /** Relleno del contenedor de la píldora (`p-1` = 4 px a cada lado). */
  relleno?: number
}

/** Suma de los `n` primeros anchos, con sus huecos. */
function anchoDe(anchos: number[], n: number, hueco: number): number {
  if (n <= 0) return 0
  let total = 0
  for (let i = 0; i < n; i++) total += anchos[i]
  return total + hueco * (n - 1)
}

export function repartirNav({
  anchosItems,
  anchoDisponible,
  anchoBotonMas,
  huecoEntreItems = 4,
  relleno = 8,
}: EntradaRepartoNav): RepartoNav {
  const total = anchosItems.length

  // ── Medidas que no valen ────────────────────────────────────────────────────────────────
  // Antes del primer layout todos los anchos son 0, y un `clientWidth` de 0 significa que el
  // elemento aún no está en pantalla. Con esas cifras el cálculo diría «no cabe ninguno» y
  // escondería el menú entero. Se declara NO MEDIDO y se pintan todos.
  const anchosValidos = total > 0 && anchosItems.every((a) => Number.isFinite(a) && a > 0)
  if (!anchosValidos || !Number.isFinite(anchoDisponible) || anchoDisponible <= 0) {
    return { visibles: total, ocultos: 0, medido: false }
  }

  const util = anchoDisponible - relleno

  // ── ¿Caben TODOS sin botón «Más»? ───────────────────────────────────────────────────────
  // Se comprueba antes que nada y sin reservar sitio para el botón: si no, un menú que cabe
  // justo perdería su último enlace para hacerle hueco a un botón que no hacía falta.
  if (anchoDe(anchosItems, total, huecoEntreItems) <= util) {
    return { visibles: total, ocultos: 0, medido: true }
  }

  // ── Con «Más», ¿cuántos caben delante? ──────────────────────────────────────────────────
  let visibles = 0
  for (let n = total; n >= 1; n--) {
    const ancho = anchoDe(anchosItems, n, huecoEntreItems) + huecoEntreItems + anchoBotonMas
    if (ancho <= util) {
      visibles = n
      break
    }
  }

  return { visibles, ocultos: total - visibles, medido: true }
}

/**
 * Dónde se pega la barra del examen para no quedar DETRÁS de la cabecera.
 *
 * El fallo real (Manolo, 28/07/2026): `top-0` + `z-30` bajo una cabecera `sticky top-0 z-50`
 * de ~105 px → barra invisible y sin recibir clics. Estos casos fijan el cálculo; la prueba
 * de que en el navegador de verdad se ve y se puede pulsar está en
 * `e2e/smoke-examen-barra.spec.ts` (esto solo no lo habría cazado).
 */
import { offsetBajoCabecera } from '@/lib/ui/stickyOffset'

const rect = (top: number, bottom: number) => ({ top, bottom })

describe('offsetBajoCabecera', () => {
  it('sin cabecera no desplaza nada', () => {
    expect(offsetBajoCabecera(null)).toBe(0)
    expect(offsetBajoCabecera(undefined)).toBe(0)
  })

  it('se pega justo bajo la cabecera pegada arriba', () => {
    expect(offsetBajoCabecera(rect(0, 105), [], { altoViewport: 844 })).toBe(105)
  })

  it('cuenta la fila que asoma por debajo (segunda fila móvil, absolute top-full)', () => {
    // La cabecera mide 105 pero la fila de racha/leyes cuelga hasta 142: pegarse a 105
    // dejaría la barra tapada por esa fila.
    expect(offsetBajoCabecera(rect(0, 105), [rect(105, 142)], { altoViewport: 844 })).toBe(142)
  })

  it('ignora filas que quedan DENTRO de la caja de la cabecera', () => {
    expect(offsetBajoCabecera(rect(0, 105), [rect(10, 60)], { altoViewport: 844 })).toBe(105)
  })

  it('una cabecera que ya se fue con el scroll no tapa: offset 0', () => {
    // Caso de cabecera NO pegajosa (o desplazada hacia arriba). Sumar su alto dejaría un
    // hueco absurdo bajo el que no hay nada.
    expect(offsetBajoCabecera(rect(-200, -95), [], { altoViewport: 844 })).toBe(0)
  })

  it('nunca consume más de un tercio largo de la pantalla', () => {
    // Defensa: si algo mide mal (un desplegable abierto, un aviso gigante), la barra no
    // puede hundirse media pantalla. Fue justo lo que pasó al escanear posicionados: un
    // menú oculto de 457 px empujó la barra a 295.
    expect(offsetBajoCabecera(rect(0, 561), [], { altoViewport: 844 })).toBe(295)
    expect(offsetBajoCabecera(rect(0, 561), [], { altoViewport: 844, maxFraccion: 0.2 })).toBe(169)
  })

  it('sin alto de viewport no aplica tope (SSR / entorno sin ventana)', () => {
    expect(offsetBajoCabecera(rect(0, 561), [])).toBe(561)
  })

  it('redondea a píxeles enteros y nunca devuelve negativos', () => {
    expect(offsetBajoCabecera(rect(0, 104.6), [], { altoViewport: 844 })).toBe(105)
    expect(offsetBajoCabecera(rect(0, 0), [], { altoViewport: 844 })).toBe(0)
  })

  it('aguanta valores no finitos sin romper el render', () => {
    expect(offsetBajoCabecera(rect(0, Number.NaN), [], { altoViewport: 844 })).toBe(0)
    expect(offsetBajoCabecera(rect(0, 105), [rect(0, Number.POSITIVE_INFINITY)], { altoViewport: 844 })).toBe(105)
  })
})

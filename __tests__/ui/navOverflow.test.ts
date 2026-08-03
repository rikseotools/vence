/**
 * El criterio del reparto de la barra de navegación (T-504).
 *
 * Las cifras de los casos «reales» son las MEDIDAS contra producción el 03/08/2026 con
 * navegador real: la píldora ocupaba 1.003 px con 8 enlaces (premium) y 852 px con 7 (free),
 * y el `<nav>` recibía entre ~200 y ~1.000 px según la anchura de pantalla.
 */

import { repartirNav } from '@/lib/ui/navOverflow'

// Anchos aproximados de los ocho enlaces reales, en su orden del menú.
const OCHO = [78, 104, 122, 168, 132, 190, 176, 150]

describe('cuando las medidas no son de fiar', () => {
  it('sin anchos todavía (primer render) pinta TODOS y se declara no medido', () => {
    const r = repartirNav({ anchosItems: [0, 0, 0], anchoDisponible: 400, anchoBotonMas: 70 })
    expect(r).toEqual({ visibles: 3, ocultos: 0, medido: false })
  })

  it('con el nav aún fuera de pantalla (clientWidth 0) pinta TODOS', () => {
    const r = repartirNav({ anchosItems: OCHO, anchoDisponible: 0, anchoBotonMas: 70 })
    expect(r.medido).toBe(false)
    expect(r.visibles).toBe(8)
  })

  it('un ancho suelto a cero basta para no fiarse: no se esconde media barra por una medida mala', () => {
    const r = repartirNav({ anchosItems: [100, 0, 100], anchoDisponible: 150, anchoBotonMas: 70 })
    expect(r.medido).toBe(false)
    expect(r.visibles).toBe(3)
  })

  it('NaN/Infinity tampoco cuelan', () => {
    expect(repartirNav({ anchosItems: [NaN, 10], anchoDisponible: 500, anchoBotonMas: 70 }).medido).toBe(false)
    expect(repartirNav({ anchosItems: [10, 10], anchoDisponible: Infinity, anchoBotonMas: 70 }).medido).toBe(false)
  })

  it('sin enlaces no hay nada que repartir', () => {
    expect(repartirNav({ anchosItems: [], anchoDisponible: 500, anchoBotonMas: 70 })).toEqual({
      visibles: 0, ocultos: 0, medido: false,
    })
  })
})

describe('cuando caben todos', () => {
  it('no aparece el botón «Más» aunque sobre poco sitio', () => {
    // 3 enlaces de 100 + 2 huecos de 4 = 308; relleno 8 → hacen falta 316.
    const r = repartirNav({ anchosItems: [100, 100, 100], anchoDisponible: 316, anchoBotonMas: 70 })
    expect(r).toEqual({ visibles: 3, ocultos: 0, medido: true })
  })

  it('el último enlace NO se sacrifica por un botón que no hace falta', () => {
    // Justo justo: si se reservara sitio para «Más» sin comprobar antes, saldrían 2 visibles
    // + 1 oculto, que es peor en todo — un clic más para llegar a algo que cabía.
    const r = repartirNav({ anchosItems: [100, 100], anchoDisponible: 212, anchoBotonMas: 70 })
    expect(r.ocultos).toBe(0)
  })
})

describe('cuando no caben', () => {
  it('reserva sitio para «Más» y deja dentro lo que quepa', () => {
    // 2 enlaces (204) + hueco (4) + Más (70) = 278; +relleno 8 = 286 ≤ 300. El tercero no.
    const r = repartirNav({ anchosItems: [100, 100, 100], anchoDisponible: 300, anchoBotonMas: 70 })
    expect(r).toEqual({ visibles: 2, ocultos: 1, medido: true })
  })

  it('si no cabe ni uno, TODO se pliega en «Más» — pero nada se pierde', () => {
    const r = repartirNav({ anchosItems: [200, 200], anchoDisponible: 120, anchoBotonMas: 70 })
    expect(r.visibles).toBe(0)
    expect(r.ocultos).toBe(2)
    expect(r.medido).toBe(true)
  })

  it('el reparto conserva SIEMPRE todos los enlaces (visibles + ocultos)', () => {
    for (const disponible of [0, 50, 120, 300, 700, 1003, 1200, 5000]) {
      const r = repartirNav({ anchosItems: OCHO, anchoDisponible: disponible, anchoBotonMas: 70 })
      expect(r.visibles + r.ocultos).toBe(OCHO.length)
      expect(r.visibles).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('las anchuras REALES medidas en producción', () => {
  // El `<nav>` recibe: contenedor − logo − bloque derecho − márgenes.
  const CASOS: Array<[string, number, number[]]> = [
    ['premium @1920', 620, OCHO],
    ['premium @1440', 370, OCHO],
    ['premium @1280', 310, OCHO],
    ['free @1920', 470, OCHO.slice(0, 7)],
    ['free @1280', 200, OCHO.slice(0, 7)],
  ]

  it.each(CASOS)('%s: lo que se pinta NUNCA excede el sitio disponible', (_n, disponible, items) => {
    const r = repartirNav({ anchosItems: items, anchoDisponible: disponible, anchoBotonMas: 70 })
    const hueco = 4
    const pintado =
      (r.visibles > 0 ? items.slice(0, r.visibles).reduce((a, b) => a + b, 0) + hueco * (r.visibles - 1) : 0) +
      (r.ocultos > 0 ? (r.visibles > 0 ? hueco : 0) + 70 : 0) +
      8
    expect(pintado).toBeLessThanOrEqual(disponible)
  })

  it('a 1920 con premium entran varios enlaces: el arreglo no convierte el escritorio en un móvil', () => {
    const r = repartirNav({ anchosItems: OCHO, anchoDisponible: 620, anchoBotonMas: 70 })
    expect(r.visibles).toBeGreaterThanOrEqual(3)
    expect(r.ocultos).toBeGreaterThan(0)
  })
})

describe('crecer no vuelve a romper la cabecera', () => {
  it('añadir un noveno enlace no quita sitio a nadie: se pliega solo', () => {
    const antes = repartirNav({ anchosItems: OCHO, anchoDisponible: 620, anchoBotonMas: 70 })
    const despues = repartirNav({ anchosItems: [...OCHO, 160], anchoDisponible: 620, anchoBotonMas: 70 })
    expect(despues.visibles).toBe(antes.visibles)
    expect(despues.ocultos).toBe(antes.ocultos + 1)
  })

  it('un enlace con una etiqueta larguísima no desborda: se va a «Más»', () => {
    const r = repartirNav({ anchosItems: [100, 4000], anchoDisponible: 300, anchoBotonMas: 70 })
    expect(r.visibles).toBe(1)
    expect(r.ocultos).toBe(1)
  })
})

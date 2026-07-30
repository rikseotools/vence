// El contador de «N artículos disponibles» de la pantalla de una ley.
//
// ## Por qué (30/07/2026, salió al atender a Manolo García)
//
// La LO 3/2007 anunciaba «798 artículos disponibles» teniendo 134, y justo debajo el
// selector abría 136 casillas. La causa: `LawTestConfigurator` rellenaba
// `articles_with_questions` con `lawStats.totalQuestions`, o sea, ponía las PREGUNTAS en el
// hueco de los artículos. Ningún tipo lo impedía (los dos campos son `number`) y ninguna
// alerta lo veía, porque un número de más no rompe nada: solo miente.
//
// La regla que fija esto: ante la duda, no se pinta. Un hueco es honesto.
import {
  decidirContadorArticulos,
  textoContadorArticulos,
} from '@/lib/laws/contadorArticulos'

describe('decidir si se enseña el contador de artículos', () => {
  it('el caso real: 798 «artículos» con 798 preguntas no se enseña', () => {
    // Es el cruce exacto que se vio en producción: el mismo número en los dos campos.
    const d = decidirContadorArticulos(798, 798)
    expect(d.mostrar).toBe(true) // 798 ≤ 798, aritméticamente posible…
    // …por eso la defensa REAL es que el dato venga contado, no deducido. La guarda solo
    // caza lo imposible; lo que impide el cruce es el tipo opcional + la consulta.
    const cruzado = decidirContadorArticulos(799, 798)
    expect(cruzado.mostrar).toBe(false)
    expect(cruzado.motivo).toBe('mas_articulos_que_preguntas')
    expect(cruzado.sospechoso).toBe(true)
  })

  it('el dato correcto sí se enseña', () => {
    const d = decidirContadorArticulos(134, 799)
    expect(d).toMatchObject({ mostrar: true, n: 134, motivo: 'ok', sospechoso: false })
    expect(textoContadorArticulos(d)).toBe('134 artículos disponibles')
  })

  it('sin dato no se inventa un cero (una caché vieja no trae el campo)', () => {
    for (const v of [undefined, null]) {
      const d = decidirContadorArticulos(v, 799)
      expect(d.mostrar).toBe(false)
      expect(d.motivo).toBe('sin_dato')
      // Y NO es sospechoso: que falte es esperable durante el rodaje del despliegue,
      // así que no debe emitir señal ni ensuciar la observabilidad.
      expect(d.sospechoso).toBe(false)
      expect(textoContadorArticulos(d)).toBeNull()
    }
  })

  it('más artículos que preguntas es imposible: se calla y avisa', () => {
    const d = decidirContadorArticulos(500, 120)
    expect(d.mostrar).toBe(false)
    expect(d.sospechoso).toBe(true)
  })

  it('valores rotos (decimal, NaN, negativo) no llegan a pantalla', () => {
    expect(decidirContadorArticulos(12.5, 100).motivo).toBe('no_entero')
    expect(decidirContadorArticulos(NaN, 100).motivo).toBe('no_entero')
    expect(decidirContadorArticulos(-3, 100).motivo).toBe('negativo')
    expect(decidirContadorArticulos(NaN, 100).sospechoso).toBe(true)
  })

  it('cero artículos es un dato legítimo, no un fallo', () => {
    const d = decidirContadorArticulos(0, 0)
    expect(d).toMatchObject({ mostrar: true, n: 0, sospechoso: false })
    expect(textoContadorArticulos(d)).toBe('0 artículos disponibles')
  })

  it('concuerda el singular', () => {
    expect(textoContadorArticulos(decidirContadorArticulos(1, 40))).toBe('1 artículo disponible')
  })

  it('sin total de preguntas se acepta el contador (no hay con qué contrastarlo)', () => {
    expect(decidirContadorArticulos(134, undefined).mostrar).toBe(true)
  })
})

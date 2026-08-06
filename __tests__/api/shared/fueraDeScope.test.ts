/**
 * `fueraDeScope` — el juicio «esto que acabo de servir, ¿entra en su temario?» en JS puro
 * (`lib/api/_shared/topicScopeSql.ts`, [T-607]).
 *
 * Es el gemelo en memoria de `articleInScope`, que es SQL. Los casos de aquí son los que hicieron
 * falta para no repetir los dos errores de medida que costaron T-583:
 *   · `article_numbers IS NULL` es **toda la ley**, no «ninguno» (el bug de 2026-06-10, 283 temas
 *     sirviendo tests vacíos, nació justo de tratar ese NULL como una lista vacía).
 *   · La comparación es por (ley, artículo) JUNTOS. Comparar solo por número es lo que hizo que una
 *     pregunta del art. 9 de una ley gallega pareciera servida en Guardia Civil, cuyo tema 2 escopa
 *     el art. 9 de OTRA ley.
 */
import { fueraDeScope } from '@/lib/api/_shared/topicScopeSql'

const LEY_A = 'aaaaaaaa-0000-0000-0000-000000000001'
const LEY_B = 'bbbbbbbb-0000-0000-0000-000000000002'

const q = (lawId: string | null, articleNumber: string | null, id = 'q1') => ({ id, lawId, articleNumber })

describe('lo normal', () => {
  it('un artículo listado en su ley está DENTRO', () => {
    expect(fueraDeScope([q(LEY_A, '7')], [{ lawId: LEY_A, articleNumbers: ['7', '8'] }])).toEqual([])
  })

  it('un artículo de esa ley que NO está listado se marca', () => {
    const fuera = fueraDeScope([q(LEY_A, '28')], [{ lawId: LEY_A, articleNumbers: ['7', '8'] }])
    expect(fuera.map((x) => x.id)).toEqual(['q1'])
  })

  it('una ley que la oposición no escopa EN ABSOLUTO se marca entera', () => {
    const fuera = fueraDeScope([q(LEY_B, '1')], [{ lawId: LEY_A, articleNumbers: ['1'] }])
    expect(fuera.map((x) => x.id)).toEqual(['q1'])
  })
})

describe('article_numbers NULL = TODA la ley (la convención que rompió 283 temas en junio)', () => {
  it('con NULL, cualquier artículo de esa ley entra', () => {
    expect(fueraDeScope([q(LEY_A, '999')], [{ lawId: LEY_A, articleNumbers: null }])).toEqual([])
  })

  it('el NULL de un tema GANA sobre la lista acotada de otro tema de la misma ley', () => {
    const scope = [
      { lawId: LEY_A, articleNumbers: ['1'] },
      { lawId: LEY_A, articleNumbers: null },
    ]
    expect(fueraDeScope([q(LEY_A, '77')], scope)).toEqual([])
    // …y da igual en qué orden lleguen las filas: no puede depender del ORDER BY.
    expect(fueraDeScope([q(LEY_A, '77')], [...scope].reverse())).toEqual([])
  })

  it('un array VACÍO es una fila inerte: no aporta, no convierte la ley en «toda»', () => {
    const fuera = fueraDeScope([q(LEY_A, '3')], [{ lawId: LEY_A, articleNumbers: [] }])
    expect(fuera.map((x) => x.id)).toEqual(['q1'])
  })
})

describe('la ley y el artículo se comparan JUNTOS (el error que inventó la fuga de T-583)', () => {
  it('mismo número de artículo en OTRA ley no cuenta como dentro', () => {
    // Guardia Civil T2 escopa la LO 3/2007 arts. 0-13; la pregunta era del art. 9 de una ley gallega.
    const scope = [{ lawId: LEY_A, articleNumbers: ['0', '9', '13'] }]
    const fuera = fueraDeScope([q(LEY_B, '9')], scope)
    expect(fuera.map((x) => x.id)).toEqual(['q1'])
  })

  it('la unión de varios temas de la MISMA ley suma, no se pisa', () => {
    const scope = [
      { lawId: LEY_A, articleNumbers: ['1', '2'] },
      { lawId: LEY_A, articleNumbers: ['30'] },
    ]
    expect(fueraDeScope([q(LEY_A, '30'), q(LEY_A, '2', 'q2')], scope)).toEqual([])
  })
})

describe('no inventa fugas donde no puede saber', () => {
  it('una pregunta sin ley o sin artículo NO se marca (no hay con qué juzgarla)', () => {
    expect(fueraDeScope([q(null, '7'), q(LEY_A, null, 'q2')], [{ lawId: LEY_A, articleNumbers: ['7'] }]))
      .toEqual([])
  })

  it('sin scope y sin servidas, no hay nada que decir', () => {
    expect(fueraDeScope([], [])).toEqual([])
  })

  it('filas de scope sin ley se ignoran en vez de romper', () => {
    expect(fueraDeScope([q(LEY_A, '7')], [{ lawId: null, articleNumbers: ['7'] }, { lawId: LEY_A, articleNumbers: ['7'] }]))
      .toEqual([])
  })
})

describe('el número de artículo es TEXTO, no número', () => {
  it('«7 bis» y «7» son artículos distintos', () => {
    const scope = [{ lawId: LEY_A, articleNumbers: ['7'] }]
    expect(fueraDeScope([q(LEY_A, '7 bis')], scope).map((x) => x.id)).toEqual(['q1'])
  })

  it('no normaliza el texto: «07» no es «7»', () => {
    const scope = [{ lawId: LEY_A, articleNumbers: ['7'] }]
    expect(fueraDeScope([q(LEY_A, '07')], scope).map((x) => x.id)).toEqual(['q1'])
  })
})

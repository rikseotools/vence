/**
 * @jest-environment node
 */
// Tests del clasificador de notas de vigencia del TC (T-132).
//
// Las notas de abajo son LITERALES del BOE consolidado, descargadas el 26/07/2026 de
// `legislacion-consolidada/id/BOE-A-2017-12902/texto/bloque/<id>`. La gracia del caso es
// que las tres vienen de la MISMA sentencia (STC 68/2021) y aun así exigen remediaciones
// distintas: los arts. 46 y 347 tienen incisos nulos; el 72 no es nulo, es inaplicable
// como básico. Confundirlas llevaría a jubilar preguntas que solo necesitan una nota.

const {
  clasificarNotaVigencia,
  contentReflejaCompetencial,
  parseApartados,
} = require('@/lib/laws/notaVigenciaTc')

const NOTA_72_COMPETENCIAL =
  'Téngase en cuenta que se declara que el apartado 4 no es conforme con el orden constitucional de competencias, en los términos del fundamento jurídico 6 G) c), por la Sentencia del TC 68/2021, de 18 de marzo. Ref. BOE-A-2021-6614'
const NOTA_46_NULIDAD =
  'Téngase en cuenta que se declara inconstitucional y nulo el párrafo segundo del apartado 4 por la Sentencia del TC 68/2021, de 18 de marzo. Ref. BOE-A-2021-6614'
const NOTA_347_NULIDAD =
  'Téngase en cuenta que se declara inconstitucional y nulo el inciso destacado del párrafo 5 del apartado 3 por la Sentencia del TC 68/2021, de 18 de marzo. Ref. BOE-A-2021-6614'

describe('notaVigenciaTc — el hueco que abre T-132', () => {
  it('caza la fórmula COMPETENCIAL, que no contiene "inconstitucional" (art. 72 LCSP)', () => {
    const r = clasificarNotaVigencia(NOTA_72_COMPETENCIAL)
    expect(r.clase).toBe('competencial')
    expect(r.sentencia).toBe('STC 68/2021')
    expect(r.refBoe).toBe('BOE-A-2021-6614')
    expect(r.apartados).toContain('4')
  })

  it('el detector VIEJO de nulidad no la habría visto (regresión del punto ciego)', () => {
    // Es literalmente el filtro de annulledProvisions.ts: exige el prefijo "in-".
    const FILTRO_VIEJO = /\binconstitucional|\bnul(?:idad|o|a|os|as)\b|\banulad/i
    expect(FILTRO_VIEJO.test(NOTA_72_COMPETENCIAL)).toBe(false)
  })
})

describe('notaVigenciaTc — sigue distinguiendo la nulidad', () => {
  it('arts. 46 y 347 de la LCSP → nulidad, misma sentencia', () => {
    for (const n of [NOTA_46_NULIDAD, NOTA_347_NULIDAD]) {
      const r = clasificarNotaVigencia(n)
      expect(r.clase).toBe('nulidad')
      expect(r.sentencia).toBe('STC 68/2021')
    }
  })

  it('si una nota menciona AMBAS cosas manda la nulidad (es la más restrictiva)', () => {
    const mixta =
      'Téngase en cuenta que se declara la inconstitucionalidad y nulidad del inciso del apartado 2 y que el apartado 4 no es conforme con el orden constitucional de competencias, por la Sentencia del TC 68/2021.'
    expect(clasificarNotaVigencia(mixta).clase).toBe('nulidad')
  })
})

describe('notaVigenciaTc — no confundir cualquier aviso con un pronunciamiento', () => {
  it('una nota de entrada en vigor NO es hallazgo', () => {
    expect(clasificarNotaVigencia('Téngase en cuenta que esta disposición entrará en vigor el 1 de enero de 2027.').clase).toBe('otra')
  })

  it('una nota que remite a otra norma sin declarar nada NO es hallazgo', () => {
    expect(clasificarNotaVigencia('Téngase en cuenta que la referencia debe entenderse hecha a la Ley 40/2015.').clase).toBe('otra')
  })

  it('sin nota → clase null, no "otra"', () => {
    expect(clasificarNotaVigencia(null).clase).toBeNull()
    expect(clasificarNotaVigencia('   ').clase).toBeNull()
  })

  it('no casa con un artículo que simplemente HABLA de constitucionalidad', () => {
    const lotc = 'El Tribunal podrá declarar la constitucionalidad de los preceptos impugnados conforme al orden constitucional.'
    expect(clasificarNotaVigencia(lotc).clase).toBe('otra')
  })
})

describe('notaVigenciaTc — ¿nuestro content ya lo refleja?', () => {
  it('detecta que el content ya lleva la advertencia competencial', () => {
    expect(contentReflejaCompetencial('… el apartado 4 no es conforme con el orden constitucional de competencias (STC 68/2021).')).toBe(true)
  })

  it('un content limpio del art. 72 NO la refleja → hallazgo legítimo', () => {
    expect(contentReflejaCompetencial('4. Los órganos de contratación podrán apreciar la prohibición de contratar…')).toBe(false)
  })

  it('no se conforma con que aparezca la palabra "competencias" suelta', () => {
    expect(contentReflejaCompetencial('El órgano ejercerá las competencias que le atribuya la ley.')).toBe(false)
  })
})

describe('notaVigenciaTc — extracción de apartados', () => {
  it('extrae uno y varios', () => {
    expect(parseApartados('el apartado 4 no es conforme')).toEqual(['4'])
    expect(parseApartados('los apartados 2 y 3 quedan afectados')).toEqual(['2', '3'])
  })

  it('devuelve vacío sin reventar cuando no hay apartado', () => {
    expect(parseApartados('se declara inconstitucional el inciso destacado')).toEqual([])
  })
})

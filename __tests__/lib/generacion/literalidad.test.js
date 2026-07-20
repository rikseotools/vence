const { analizarLiteralidad } = require('../../../lib/generacion/literalidad')

describe('analizarLiteralidad', () => {
  const art53 =
    '1. La cuantía y finalidad de los créditos... sólo podrán ser modificadas... mediante: ' +
    'a) Transferencias. b) Generaciones. c) Ampliaciones. ' +
    'd) Créditos extraordinarios y suplementos de crédito. e) Incorporaciones.'

  it('reconoce una cita contigua como LITERAL', () => {
    expect(analizarLiteralidad(art53, 'sólo podrán ser modificadas').estado).toBe('LITERAL')
  })

  it('reconoce una enumeración fiel de la lista como ENUMERACION (caso art. 53)', () => {
    const cita = 'Transferencias, generaciones, ampliaciones, créditos extraordinarios y suplementos de crédito, e incorporaciones.'
    expect(analizarLiteralidad(art53, cita).estado).toBe('ENUMERACION')
  })

  it('marca NO_LITERAL una enumeración con un ítem inventado', () => {
    const cita = 'Transferencias, generaciones, ampliaciones, reasignaciones estructurales, e incorporaciones.'
    const r = analizarLiteralidad(art53, cita)
    expect(r.estado).toBe('NO_LITERAL')
    expect(r.fragmentosNoHallados.some((f) => f.includes('reasignaciones'))).toBe(true)
  })

  it('tolera la puntuación (punto final que falta en el content)', () => {
    expect(analizarLiteralidad('las Transferencias entre créditos', 'las Transferencias entre créditos.').estado).toBe('LITERAL')
  })

  it('marca NO_LITERAL una cita simple que no está en el artículo', () => {
    expect(analizarLiteralidad('El devengo se produce el 31 de diciembre', 'El devengo se produce el 30 de junio').estado).toBe('NO_LITERAL')
  })
})

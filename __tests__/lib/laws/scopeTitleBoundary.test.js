
// ─────────────────────────────────────────────────────────────────────────────
// FALSO POSITIVO REAL (25/07, Técnico Auxiliar UMU T1): el epígrafe oficial dice
// "Título preliminar" en MINÚSCULA y el detector no lo reconocía → daba los arts 1-9
// de la CE como fuera de programa. Los boletines lo escriben de las tres formas.
// ─────────────────────────────────────────────────────────────────────────────
describe('epigrafeTitles — "Título preliminar" en cualquier caja', () => {
  const { epigrafeTitles } = require('@/lib/laws/scopeTitleBoundary.js')

  it('reconoce "Título preliminar" en minúscula (caso UMU real)', () => {
    expect(epigrafeTitles('La Constitución Española de 1978: estructura y contenido. Título preliminar. Título I. Derechos y deberes fundamentales.')).toEqual([0, 1])
  })
  it('reconoce "Título Preliminar" capitalizado', () => {
    expect(epigrafeTitles('Ley 40/2015: Título Preliminar, Capítulo II.')).toEqual([0])
  })
  it('reconoce "TÍTULO PRELIMINAR" en mayúsculas', () => {
    expect(epigrafeTitles('TÍTULO PRELIMINAR y TÍTULO III')).toEqual([0, 3])
  })
  it('NO inventa títulos: los romanos siguen siendo case-sensitive', () => {
    // con flag `i` global, "civil" casaría [IVXLC]+ y metería un título fantasma
    expect(epigrafeTitles('El título civil y mercantil')).toEqual([])
    expect(epigrafeTitles('el titulo iv de la ley')).toEqual([])
  })
  it('sin títulos nombrados devuelve lista vacía', () => {
    expect(epigrafeTitles('Régimen jurídico del personal funcionario')).toEqual([])
    expect(epigrafeTitles('')).toEqual([])
  })
})

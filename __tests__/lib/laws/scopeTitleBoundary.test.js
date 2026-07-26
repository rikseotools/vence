
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

// ─────────────────────────────────────────────────────────────────────────────
// T-129 (26/07/2026) — FUGA ENTRE LEYES: los títulos del epígrafe se aplicaban a
// TODAS las leyes del tema.
//
// Caso real: `auxiliar_administrativo_ayuntamiento_marbella` T5 escopa la CE (22 arts)
// y el Estatuto de Autonomía de Andalucía (252 arts). Su epígrafe dice literalmente
// "(Constitución, Título VIII)" ×2 → el detector sacaba `permitidos:[8]` y se lo
// aplicaba al ESTATUTO, marcando 239 de sus 252 artículos como fuera de programa.
// La CE del mismo tema no se marcaba (correcto), lo que hacía el bug más confuso.
//
// Regla que fijan estos tests: un título solo cuenta para la ley que lo cualifica; y
// si el epígrafe solo cualifica títulos de OTRA ley, el detector NO opina (fail-safe:
// mejor callarse que marcar la ley entera).
// ─────────────────────────────────────────────────────────────────────────────
const { titlesForLaw: tfl, classifyTitleBoundary: ctb } = require('@/lib/laws/scopeTitleBoundary')

const EPI_MARBELLA =
  'Las Comunidades Autónomas: Constitución y competencias. Competencias del Estado y de las ' +
  'Comunidades Autónomas: Introducción al Estatuto de Autonomía para Andalucía, y su sistema de ' +
  'distribución de competencias. (Constitución, Título VIII). (Constitución Española de 1978, Título VIII).'
const CE = { shortName: 'CE', name: 'Constitución Española de 1978' }
const ESTATUTO = {
  shortName: 'LO 2/2007 Estatuto de Autonomía de Andalucía',
  name: 'Ley Orgánica 2/2007 del Estatuto de Autonomía para Andalucía',
}

describe('titlesForLaw — los títulos se atan a SU ley (T-129)', () => {
  it('el "Título VIII" cualificado como de la Constitución cuenta PARA la CE', () => {
    expect(tfl(EPI_MARBELLA, CE)).toEqual({ titles: [8], bound: true })
  })

  it('ese mismo título NO se aplica al Estatuto → el detector no opina', () => {
    expect(tfl(EPI_MARBELLA, ESTATUTO)).toEqual({ titles: [], bound: false })
  })

  it('sin ley (llamada legacy) mantiene el comportamiento anterior', () => {
    expect(tfl(EPI_MARBELLA, null)).toEqual({ titles: [8], bound: true })
  })

  it('títulos SIN ley que los cualifique son genéricos y valen para la ley dada', () => {
    const epi = 'Organización: Título I y Título II. Competencias.'
    expect(tfl(epi, ESTATUTO)).toEqual({ titles: [1, 2], bound: true })
  })
})

describe('classifyTitleBoundary — el fail-safe evita los 239 falsos positivos', () => {
  // Estructura ficticia del Estatuto: 11 títulos de 20 arts cada uno.
  const secs = Array.from({ length: 11 }, (_, i) => ({
    num: ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI'][i],
    from: i * 20 + 1,
    to: (i + 1) * 20,
  }))
  const artsEstatuto = Array.from({ length: 60 }, (_, i) => String(i + 1)) // arts 1-60

  it('ANTES del fix marcaría casi todo; AHORA no aplica', () => {
    const r = ctb(EPI_MARBELLA, secs, artsEstatuto, ESTATUTO)
    expect(r.applicable).toBe(false)
    expect(r.overflow).toEqual([])
  })

  it('sin pasar la ley se reproduce el bug (regresión documentada)', () => {
    const r = ctb(EPI_MARBELLA, secs, artsEstatuto)
    expect(r.applicable).toBe(true)
    // permitidos=[8] → todo lo que no cae en el Título VIII se marca
    expect(r.overflow.length).toBeGreaterThan(30)
  })

  it('para la ley que SÍ cualifica el epígrafe, sigue detectando el overflow', () => {
    // Con permitidos=[8] (arts 141-160), un art. del Título I es overflow real.
    const r = ctb(EPI_MARBELLA, secs, ['141', '5'], CE)
    expect(r.applicable).toBe(true)
    expect(r.overflow.map((o) => o.article)).toEqual([5])
  })
})

// ── Modelo definitivo: cada título pertenece a la ÚLTIMA norma mencionada antes de él ──
// Llegó tras DOS modelos fallidos que la medición controlada cazó. Los dos casos de abajo
// marcados «REGRESIÓN» los reproducen: si alguien vuelve a trocear por paréntesis o a usar
// una ventana de ±N caracteres, se ponen rojos.
describe('titlesForLaw — reparto multi-ley por orden de mención (T-129)', () => {
  const LO3 = { shortName: 'LO 3/2007', name: 'Ley Orgánica 3/2007 para la igualdad efectiva de mujeres y hombres' }
  const L39 = { shortName: 'Ley 39/2015', name: 'Ley 39/2015 del Procedimiento Administrativo Común' }
  const CEx = { shortName: 'CE', name: 'Constitución Española de 1978' }

  it('reparte los títulos entre las DOS leyes del epígrafe', () => {
    const epi = 'La Ley Orgánica 3/2007, de 22 de marzo: Título Preliminar; Título I; Título II, ' +
      'Políticas públicas para la igualdad. La Ley 9/2003, de la Generalitat: Título III.'
    expect(tfl(epi, LO3).titles).toEqual([0, 1, 2])
    expect(tfl(epi, { shortName: 'Ley 9/2003', name: 'Ley 9/2003 de la Generalitat' }).titles).toEqual([3])
  })

  it('REGRESIÓN (ventana de ±N chars): el Título II de la LO 3/2007 NO se pierde por tener "Ley 9/2003" cerca', () => {
    const epi = 'La Ley Orgánica 3/2007: Título II, Políticas públicas. La Ley 9/2003, de la Generalitat, para la igualdad.'
    expect(tfl(epi, LO3).titles).toContain(2)
  })

  it('REGRESIÓN (trocear por paréntesis): el "título Preliminar" fuera de paréntesis NO se pierde', () => {
    // Los paréntesis de estos epígrafes llevan el NÚMERO del título, no la ley.
    const epi = 'La Constitución Española de 1978 (I): título Preliminar, de los derechos y deberes (título I).'
    expect(tfl(epi, CEx).titles).toEqual([0, 1])
  })

  it('reconoce la ley citada por NÚMERO (nameReferenced borra los números a propósito)', () => {
    expect(tfl('La Ley 39/2015: Título IV: iniciación. Título V: revisión.', L39).titles).toEqual([4, 5])
  })

  it('reconoce la norma citada sin número aunque falte un token del nombre', () => {
    // "La Constitución de 1978" (sin "Española") debe seguir siendo la CE.
    expect(tfl('La Constitución de 1978: Título V. Título VI. Título VIII.', CEx).titles).toEqual([5, 6, 8])
  })

  it('"Tribunal Constitucional" NO cuenta como otra norma (frontera de palabra)', () => {
    const epi = 'La Constitución Española de 1978: Del Tribunal Constitucional (Título IX). De la reforma constitucional (Título X).'
    expect(tfl(epi, CEx).titles).toEqual([9, 10])
  })
})

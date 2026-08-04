/**
 * ¿El epígrafe enumera secciones de la ley, teniendo el scope «toda la ley»? [T-528]
 *
 * Los casos vienen de contradicciones REALES encontradas el 04/08 (Cantabria T6) y de los que
 * NO lo son (Granada T107, Murcia T504), que es lo que decide si el detector sirve: marcar el
 * epígrafe que pide la norma entera lo volvería inútil, porque eso es lo normal.
 */
const { seccionesNombradas, contradiceLeyEntera } = require('@/lib/laws/epigrafeEnumeraSecciones.cjs')

// Estructura real de la Ley 40/2015 (índice del BOE).
const LEY_40 = [{ num: 'PRELIMINAR' }, { num: 'I' }, { num: 'II' }, { num: 'III' }]
const CAPS_40 = [{ num: 'I' }, { num: 'II' }, { num: 'III' }, { num: 'IV' }, { num: 'V' }, { num: 'VI' }]

describe('secciones que el epígrafe nombra', () => {
  it('las saca con su tipo, en orden y sin repetir', () => {
    const epi = 'disposiciones generales (capítulo I del título preliminar), de los órganos (capítulo II del título preliminar), funcionamiento electrónico (capítulo V del título Preliminar), relaciones interadministrativas (título III).'
    expect(seccionesNombradas(epi)).toEqual([
      { tipo: 'capitulo', num: 'I' },
      { tipo: 'titulo', num: 'PRELIMINAR' },
      { tipo: 'capitulo', num: 'II' },
      { tipo: 'capitulo', num: 'V' },
      { tipo: 'titulo', num: 'III' },
    ])
  })

  it('acepta el plural y el «Libro», que usan los temarios', () => {
    expect(seccionesNombradas('capítulos I, II y V del título preliminar')).toContainEqual({ tipo: 'capitulo', num: 'I' })
    expect(seccionesNombradas('Libro Segundo. Libro III de la ley')).toContainEqual({ tipo: 'libro', num: 'III' })
  })

  it('un romano SUELTO no cuenta (sería un anexo o el nombre de un rey)', () => {
    expect(seccionesNombradas('El reinado de Felipe VI y el anexo IV')).toEqual([])
  })
})

describe('contradicción con un scope «toda la ley»', () => {
  it('CANTABRIA T6: el caso real que abrió esto', () => {
    const epi = 'La Ley 40/2015: disposiciones generales (capítulo I del título preliminar), de los órganos de las Administraciones Públicas (capítulo II del título preliminar), funcionamiento electrónico del sector público (capítulo V del título Preliminar), relaciones interadministrativas (título III).'
    const r = contradiceLeyEntera(epi, CAPS_40)
    expect(r.contradice).toBe(true)
    expect(r.reconocidas.length).toBeGreaterThanOrEqual(2)
  })

  it('GRANADA T107 / MURCIA T504: piden la norma ENTERA → no es contradicción', () => {
    const epi = 'Real Decreto 534/2024, de 11 de junio, por el que se regulan los requisitos de acceso a las enseñanzas universitarias oficiales de Grado.'
    expect(contradiceLeyEntera(epi, CAPS_40).contradice).toBe(false)
  })

  it('con UNA sola sección no se afirma nada (esa banda sería ruido)', () => {
    expect(contradiceLeyEntera('Ley 40/2015: título III, relaciones interadministrativas', LEY_40).contradice).toBe(false)
  })

  it('una sección que la ley NO tiene no prueba nada sobre el reparto de ESTA ley', () => {
    // «Título VII» no existe en la 40/2015: o es errata del temario o habla de otra norma.
    const r = contradiceLeyEntera('Ley 40/2015: título VII y título VIII', LEY_40)
    expect(r.contradice).toBe(false)
    expect(r.reconocidas).toEqual([])
  })

  it('sin secciones en la ley (no hay índice) no se opina', () => {
    expect(contradiceLeyEntera('título I y título II', []).contradice).toBe(false)
    expect(contradiceLeyEntera('título I y título II', null).contradice).toBe(false)
  })

  it('el motivo dice QUÉ lo disparó, para poder adjudicarlo sin volver a mirarlo', () => {
    const r = contradiceLeyEntera('capítulo I y capítulo II del título preliminar', CAPS_40)
    expect(r.motivo).toMatch(/capitulo I/)
    expect(r.motivo).toMatch(/capitulo II/)
  })
})

/**
 * LA FUGA ENTRE LEYES — el fallo que este núcleo cometió en su PRIMERA medición. [T-528]
 *
 * `guardia_civil` T9 tiene un epígrafe con dos normas: la Ley de Enjuiciamiento Criminal (con
 * sus Libros y Títulos) y, más adelante, la Ley 4/2015 del Estatuto de la Víctima. Sin atribuir
 * cada sección a su norma, los libros de la LECrim se le colgaban a la Ley 4/2015 y salía una
 * contradicción que no existe. Es exactamente el fallo que [T-129] ya había arreglado en
 * `scopeTitleBoundary`, y por eso la atribución se REUTILIZA de allí en vez de reescribirse.
 */
describe('cada sección cuelga de SU norma, no de la ley que se está clasificando', () => {
  const epi = 'DERECHO PROCESAL PENAL. Bloque 1. Real Decreto de 14 de septiembre de 1882, aprobatorio de la Ley de Enjuiciamiento Criminal. LIBRO I. Disposiciones generales. TÍTULO II. Bloque 2. Ley 4/2015, de 27 de abril, del Estatuto de la víctima del delito.'
  const secciones = [{ num: 'I' }, { num: 'II' }, { num: 'III' }]

  it('no atribuye a la Ley 4/2015 los libros de la LECrim', () => {
    const r = contradiceLeyEntera(epi, secciones, { shortName: 'Ley 4/2015', name: 'Estatuto de la víctima del delito' })
    expect(r.reconocidas).toEqual([])
    expect(r.contradice).toBe(false)
  })

  it('…y sí se las atribuye a la norma que de verdad las enumera', () => {
    const r = contradiceLeyEntera(epi, secciones, { shortName: 'LECrim', name: 'Ley de Enjuiciamiento Criminal' })
    expect(r.contradice).toBe(true)
  })

  it('sin pasar la ley se mantiene el comportamiento de antes (todas las secciones)', () => {
    expect(contradiceLeyEntera(epi, secciones).contradice).toBe(true)
  })
})

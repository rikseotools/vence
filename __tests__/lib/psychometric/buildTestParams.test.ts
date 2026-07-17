import {
  buildPsychometricTestParams,
  type PsychoCategoryLike,
} from '@/lib/psychometric/buildTestParams'

// Catálogo simplificado calcado del real:
//  - razonamiento-verbal: CON secciones (sinónimos, analogías, definiciones, frases)
//  - series-numericas: SIN secciones
//  - figuras: SIN secciones
const CATALOG: PsychoCategoryLike[] = [
  {
    key: 'razonamiento-verbal',
    sections: [
      { key: 'sinonimos-antonimos' },
      { key: 'analogias-verbales' },
      { key: 'definiciones' },
      { key: 'organizacion-frases' },
    ],
  },
  { key: 'series-numericas', sections: [] },
  { key: 'figuras', sections: [] },
]

const allSectionsFalse = () => ({
  'sinonimos-antonimos': false,
  'analogias-verbales': false,
  definiciones: false,
  'organizacion-frases': false,
})

describe('buildPsychometricTestParams', () => {
  // BUG DE LAURA (17/07/2026): seleccionar EXCLUSIVAMENTE "sinónimos y antónimos"
  // servía también definiciones, frases y analogías (toda la categoría verbal).
  it('sección única: sólo esa sección, NUNCA la categoría entera', () => {
    const { categoryKeys, sectionKeys } = buildPsychometricTestParams(
      CATALOG,
      { 'razonamiento-verbal': true },
      { ...allSectionsFalse(), 'sinonimos-antonimos': true }
    )
    expect(sectionKeys).toEqual(['sinonimos-antonimos'])
    // Clave: la categoría con secciones NO aparece como categoría entera.
    expect(categoryKeys).not.toContain('razonamiento-verbal')
    expect(categoryKeys).toEqual([])
  })

  it('varias secciones de una categoría: exactamente esas secciones', () => {
    const { categoryKeys, sectionKeys } = buildPsychometricTestParams(
      CATALOG,
      { 'razonamiento-verbal': true },
      { ...allSectionsFalse(), 'sinonimos-antonimos': true, definiciones: true }
    )
    expect(sectionKeys.sort()).toEqual(['definiciones', 'sinonimos-antonimos'])
    expect(categoryKeys).toEqual([])
  })

  it('categoría con secciones TODAS seleccionadas: se representa por sus secciones (no por la categoría)', () => {
    const { categoryKeys, sectionKeys } = buildPsychometricTestParams(
      CATALOG,
      { 'razonamiento-verbal': true },
      {
        'sinonimos-antonimos': true,
        'analogias-verbales': true,
        definiciones: true,
        'organizacion-frases': true,
      }
    )
    expect(sectionKeys.sort()).toEqual([
      'analogias-verbales',
      'definiciones',
      'organizacion-frases',
      'sinonimos-antonimos',
    ])
    expect(categoryKeys).toEqual([])
  })

  it('categoría SIN secciones: se representa por la clave de categoría', () => {
    const { categoryKeys, sectionKeys } = buildPsychometricTestParams(
      CATALOG,
      { 'series-numericas': true },
      allSectionsFalse()
    )
    expect(categoryKeys).toEqual(['series-numericas'])
    expect(sectionKeys).toEqual([])
  })

  // Regresión del OTRO bug latente: mezclar categoría parcial (con secciones)
  // + categorías enteras sin secciones NO debe descartar las enteras.
  it('mezcla: sección de verbal + categorías sin secciones → ambas partes presentes', () => {
    const { categoryKeys, sectionKeys } = buildPsychometricTestParams(
      CATALOG,
      { 'razonamiento-verbal': true, 'series-numericas': true, figuras: true },
      { ...allSectionsFalse(), 'sinonimos-antonimos': true }
    )
    expect(sectionKeys).toEqual(['sinonimos-antonimos'])
    expect(categoryKeys.sort()).toEqual(['figuras', 'series-numericas'])
  })

  it('sin nada seleccionado → vacío', () => {
    const { categoryKeys, sectionKeys } = buildPsychometricTestParams(
      CATALOG,
      {},
      allSectionsFalse()
    )
    expect(categoryKeys).toEqual([])
    expect(sectionKeys).toEqual([])
  })
})

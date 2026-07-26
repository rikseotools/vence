// __tests__/lib/laws/lawNameMatch.test.js
// Matcher ley↔epígrafe (T-129, 26/07/2026).
//
// Esta lógica llevaba meses en producción DENTRO de `scripts/audit-epigrafe-scope.cjs`
// y por tanto **sin un solo test**: el script abre BD al cargarse, así que no se podía
// importar. Al promoverla a `lib/laws/lawNameMatch.cjs` deja de ser un silo y se puede
// fijar su comportamiento. Los casos de abajo son los que el propio script documenta
// en sus comentarios (EBEP, nombres cortos de leyes virtuales de ofimática) más los que
// necesita el arreglo de la fuga entre leyes.

const { extractLawRefs, nameReferenced, norm } = require('@/lib/laws/lawNameMatch.cjs')

describe('extractLawRefs — identificadores de norma en texto libre', () => {
  it('saca "N/AAAA" de las formas habituales', () => {
    const refs = extractLawRefs('La Ley 39/2015 y el Real Decreto 203/2021, más la LO 3/2018.')
    expect([...refs].sort()).toEqual(['203/2021', '3/2018', '39/2015'].sort())
  })

  it('reconoce reglamentos UE con forma AAAA/NNN (RGPD)', () => {
    expect([...extractLawRefs('Reglamento (UE) 2016/679')]).toContain('2016/679')
  })

  it('texto sin normas → conjunto vacío', () => {
    expect(extractLawRefs('Ofimática: procesador de textos').size).toBe(0)
  })

  it('no revienta con null/undefined', () => {
    expect(extractLawRefs(null).size).toBe(0)
    expect(extractLawRefs(undefined).size).toBe(0)
  })
})

describe('nameReferenced — ¿el epígrafe nombra esta ley?', () => {
  it('reconoce la ley por su nombre descriptivo (EBEP ↔ RDL 5/2015)', () => {
    expect(nameReferenced(
      'Real Decreto Legislativo 5/2015, Estatuto Básico del Empleado Público',
      'RDL 5/2015',
      'Tema 10: el Estatuto Básico del Empleado Público. Derechos y deberes.',
    )).toBe(true)
  })

  it('expande acrónimos frecuentes: "EBEP" en el epígrafe casa con RDL 5/2015', () => {
    expect(nameReferenced(
      'Real Decreto Legislativo 5/2015, Estatuto Básico del Empleado Público',
      'RDL 5/2015',
      'El EBEP y la carrera profesional',
    )).toBe(true)
  })

  it('NO da por nombrada una ley que el epígrafe no menciona', () => {
    expect(nameReferenced(
      'Ley 9/2017 de Contratos del Sector Público',
      'Ley 9/2017',
      'Tema 3: la protección de datos personales y la transparencia.',
    )).toBe(false)
  })

  it('acepta nombres CORTOS si todos sus tokens aparecen (leyes virtuales de ofimática)', () => {
    expect(nameReferenced('Windows 10', 'Windows 10', 'Sistema operativo Windows 10: escritorio')).toBe(true)
  })

  it('es insensible a acentos y mayúsculas', () => {
    expect(nameReferenced(
      'Ley Orgánica 2/2007 del Estatuto de Autonomía para Andalucía',
      'LO 2/2007',
      'introduccion al ESTATUTO de AUTONOMIA para andalucia',
    )).toBe(true)
  })

  it('norm() quita acentos y baja a minúsculas', () => {
    expect(norm('Constitución Española')).toBe('constitucion espanola')
  })
})

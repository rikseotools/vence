/**
 * Núcleo de «el programa nombra una norma que la oposición no sirve» (T-055).
 *
 * Se prueba aquí porque el criterio decide si alguien va a TOCAR UN TEMARIO. Los casos negativos
 * pesan más que los positivos: cada falso positivo manda a una persona a «arreglar» un temario que
 * estaba bien, y por eso este detector acabó siendo bajo demanda en vez de badge.
 */
const {
  epigrafeNombraLey, clasificar, mismaFamiliaYaServida, significativas,
} = require('@/lib/health/normaDelEpigrafeSinEscopar.cjs')

// El epígrafe REAL de guardia_civil T1, recortado: enumera 14 normas y el scope tenía 2.
const EPI_GC_T1 =
  'DERECHOS HUMANOS. Bloque único. Carta de las Naciones Unidas. Órganos. Declaración Universal de ' +
  'Derechos Humanos. Convenio europeo para la protección de los Derechos Humanos y de las Libertades ' +
  'Fundamentales. Carta Social Europea (revisada). Pacto Internacional de Derechos Económicos, Sociales ' +
  'y Culturales. Consejo de Derechos Humanos de la ONU.'

describe('epigrafeNombraLey — el programa la pide por su nombre', () => {
  it.each([
    ['Carta Social Europea', 'Carta Social Europea (revisada)'],
    ['DUDH', 'Declaración Universal de Derechos Humanos'],
    ['PIDESC', 'Pacto Internacional de Derechos Económicos, Sociales y Culturales'],
    ['Consejo DDHH ONU', 'Consejo de Derechos Humanos de las Naciones Unidas'],
  ])('caza «%s» aunque el nombre corto sea una sigla', (corto, largo) => {
    expect(epigrafeNombraLey(EPI_GC_T1, corto, largo).nombra).toBe(true)
  })

  it('NO caza una norma que el epígrafe no menciona', () => {
    expect(epigrafeNombraLey(EPI_GC_T1, 'LPRL', 'Ley 31/1995 de Prevención de Riesgos Laborales').nombra).toBe(false)
  })

  // El umbral de palabras es lo que separa una firma de una coincidencia. Con menos, «Ley 39/2015»
  // casaría con cualquier epígrafe que mencione «2015» — y una bandeja con ruido se deja de mirar.
  it('exige varias palabras significativas: una sola no es una firma', () => {
    expect(epigrafeNombraLey('Hojas de cálculo. Microsoft Excel 2019.', 'Excel 365', 'Excel 365').nombra).toBe(false)
    expect(significativas('Excel 365')).toEqual(['excel'])
    expect(significativas('CE')).toEqual([])
  })

  it('sin epígrafe no opina', () => {
    expect(epigrafeNombraLey(null, 'DUDH', 'Declaración Universal de Derechos Humanos').nombra).toBe(false)
  })
})

describe('mismaFamiliaYaServida — el falso positivo que casi se cuela al badge', () => {
  // Medido el 30/07 en auxiliar_administrativo_clm: los tres hallazgos del top eran versiones. El
  // tema escopa Excel 2019 y el detector le pedía Excel 365. Con productos, UNA palabra es la familia.
  it('calla si la oposición ya sirve otra versión del mismo producto', () => {
    expect(mismaFamiliaYaServida('Excel 365', ['Excel 2019', 'Word 2019'])).toBeTruthy()
    expect(mismaFamiliaYaServida('Outlook 365', ['Outlook 2019'])).toBeTruthy()
    expect(mismaFamiliaYaServida('LibreOffice Writer', ['Word 2016'])).toBe(false)
  })

  it('no calla cuando de verdad no hay nada de esa familia', () => {
    expect(mismaFamiliaYaServida('Carta Social Europea', ['Estatuto de Roma', 'LO 18/2003 Corte Penal'])).toBe(false)
  })

  // Caso real medido en T-055 (06/08): 5 oposiciones (guardia_civil, auxiliar_administrativo_extremadura,
  // administrativo_galicia, auxiliar_administrativo_sms, tcae_sermas_madrid) salían acusadas de no servir
  // «LEY PREVENCIÓN DE RIESGOS LABORALES ENF» (165 preg) teniendo YA escopada «LPRL» (1.096 preg) — la
  // MISMA ley. El detector solo comparaba contra el short_name de las ya-servidas ('LPRL', una sigla sin
  // palabras en común con el duplicado descriptivo); el `name` completo de LPRL sí las comparte.
  it('una sigla ya-servida ("LPRL") no comparte palabras con su duplicado descriptivo por short_name solo', () => {
    expect(mismaFamiliaYaServida('LEY PREVENCIÓN DE RIESGOS LABORALES ENF', ['LPRL'])).toBe(false)
  })

  it('pero SÍ se ve si el llamante incluye también el name completo de la ya-servida — por eso el auditor pasa ambos', () => {
    expect(mismaFamiliaYaServida(
      'LEY PREVENCIÓN DE RIESGOS LABORALES ENF',
      ['LPRL', 'Ley 31/1995, de 8 de noviembre, de Prevención de Riesgos Laborales'],
    )).toBeTruthy()
  })
})

describe('clasificar — severidad', () => {
  it('servida en otra oposición = error: el contenido existe y solo falta repartirlo', () => {
    expect(clasificar({ preguntasActivas: 271, servidaEnOtraOposicion: true })).toBe('error')
  })

  it('sin servir en ninguna parte = warn: puede ser contenido a medio construir', () => {
    expect(clasificar({ preguntasActivas: 271, servidaEnOtraOposicion: false })).toBe('warn')
  })

  it('por debajo del mínimo no se opina (la cola larga no compensa)', () => {
    expect(clasificar({ preguntasActivas: 4, servidaEnOtraOposicion: true })).toBeNull()
    expect(clasificar({ preguntasActivas: 0, servidaEnOtraOposicion: true })).toBeNull()
  })
})

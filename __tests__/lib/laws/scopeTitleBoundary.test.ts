/**
 * Detector de off-by-one de frontera de título (fix 24/07/2026, caso Mario/LOSU).
 * Fixture calcado del caso real: LOSU 2/2023, estructura oficial BOE-A-2023-7500.
 */
import { classifyTitleBoundary, seccionNumToInt } from '@/lib/laws/scopeTitleBoundary'

type Seccion = { num: string; from: number; to: number }

// Estructura título→rango de la LOSU (parseBoeSections sobre el índice del BOE).
const LOSU_SECCIONES: Seccion[] = [
  { num: 'Preliminar', from: 1, to: 1 },
  { num: 'I', from: 2, to: 3 },
  { num: 'II', from: 4, to: 5 },
  { num: 'III', from: 6, to: 8 },
  { num: 'IV', from: 9, to: 12 },
  { num: 'IX', from: 38, to: 63 },
]

// Epígrafe LITERAL del Tema 6 (verificado contra el PDF del BORM).
const EPIGRAFE_T6 =
  'Ley Orgánica 2/2023, de 22 de marzo, del Sistema Universitario: ' +
  'Título I: Funciones del sistema universitario y autonomía de las Universidades. ' +
  'Título II: Creación y reconocimiento de las Universidades y calidad del sistema universitario. ' +
  'Título IX. Régimen específico de las universidades públicas: Capítulo I. Régimen jurídico y estructura de las universidades públicas.'

describe('classifyTitleBoundary — LOSU Tema 6 (caso real Mario)', () => {
  it('caza art.1 (Título Preliminar) y art.6 (Título III) como overflow', () => {
    const scope = ['1', '2', '3', '4', '5', '6', '38', '39', '40', '41', '42', '43']
    const r = classifyTitleBoundary(EPIGRAFE_T6, LOSU_SECCIONES, scope)
    expect(r.applicable).toBe(true)
    expect(r.allowedTitles).toEqual([1, 2, 9]) // I, II, IX (Preliminar NO nombrado)
    expect(r.overflow).toEqual([
      { article: 1, titulo: 'Preliminar' },
      { article: 6, titulo: 'III' },
    ])
  })

  it('el scope YA corregido (2-5, 38-43) no da overflow', () => {
    const scope = ['2', '3', '4', '5', '38', '39', '40', '41', '42', '43']
    const r = classifyTitleBoundary(EPIGRAFE_T6, LOSU_SECCIONES, scope)
    expect(r.overflow).toEqual([])
  })

  it('NO aplica si el epígrafe no enumera títulos (prosa descriptiva)', () => {
    const r = classifyTitleBoundary('Control de accesos: conceptos, finalidad y tipos.', LOSU_SECCIONES, ['1', '2'])
    expect(r.applicable).toBe(false)
    expect(r.overflow).toEqual([])
  })

  it('artículo sin sección conocida va a unmapped, NO a overflow (fail-safe)', () => {
    const r = classifyTitleBoundary(EPIGRAFE_T6, LOSU_SECCIONES, ['2', '99'])
    expect(r.overflow).toEqual([])
    expect(r.unmapped).toEqual([99])
  })

  it('ignora artículos no puramente numéricos (6.bis, DA1) en v1', () => {
    const r = classifyTitleBoundary(EPIGRAFE_T6, LOSU_SECCIONES, ['2', '6.bis', 'DA1'])
    expect(r.overflow).toEqual([]) // '6' sí sería overflow, pero '6.bis' se ignora
    expect(r.unmapped).toEqual([])
  })
})

describe('classifyTitleBoundary — exención por RÚBRICA (título nombrado por materia)', () => {
  // Falso positivo real (León T4): el epígrafe nombra "La Organización Territorial
  // del Estado" (= Título VIII CE) por su NOMBRE, no por su número → NO es overflow.
  const CE_SECS = [
    { num: 'Preliminar', from: 1, to: 9, rubrica: '' },
    { num: 'VIII', from: 137, to: 158, rubrica: 'De la Organización Territorial del Estado' },
  ]
  const EP_LEON = 'La Organización Territorial del Estado. Las Comunidades Autónomas. El Estatuto de Autonomía de Castilla y León: Estructura. Título Preliminar.'

  it('no marca un título que el epígrafe nombra por su rúbrica (CE Título VIII)', () => {
    const r = classifyTitleBoundary(EP_LEON, CE_SECS, ['137', '140', '158'])
    expect(r.applicable).toBe(true)         // el epígrafe SÍ nombra un título ("Título Preliminar")
    expect(r.overflow).toEqual([])          // pero el VIII está cubierto por rúbrica → no overflow
  })

  it('SIN rúbrica coincidente sí marca (no hay materia común)', () => {
    const secs = [{ num: 'V', from: 100, to: 110, rubrica: 'De la Corona' }]
    const r = classifyTitleBoundary(EP_LEON, secs, ['100'])
    expect(r.overflow).toEqual([{ article: 100, titulo: 'V' }])
  })

  it('NO enmascara el art.6 LOSU: "funciones" (epígrafe) no casa con "función docente" (rúbrica Tít III) — sin stemming', () => {
    const secs = [
      { num: 'I', from: 2, to: 3, rubrica: 'De las funciones y la autonomía' },
      { num: 'III', from: 6, to: 10, rubrica: 'De la función docente y la organización de enseñanzas' },
    ]
    const r = classifyTitleBoundary(EPIGRAFE_T6, secs, ['6'])
    expect(r.overflow).toEqual([{ article: 6, titulo: 'III' }])
  })
})

describe('seccionNumToInt', () => {
  it('mapea Preliminar→0 y romanos→entero', () => {
    expect(seccionNumToInt('Preliminar')).toBe(0)
    expect(seccionNumToInt('I')).toBe(1)
    expect(seccionNumToInt('IX')).toBe(9)
    expect(seccionNumToInt('III')).toBe(3)
  })
})

describe('titlesForLaw — una norma citada POR NOMBRE no puede filtrar sus títulos a las demás', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { titlesForLaw } = require('@/lib/laws/scopeTitleBoundary')

  // Forma REAL del epígrafe de `guardia_civil` T9 (verified_literal contra el
  // TEMARIO INGRESO GC ACTUALIZADO 2024 clonado en el hub), recortado a lo esencial.
  const GC_T9 = [
    'DERECHO PROCESAL PENAL.',
    'Bloque 1. Real Decreto de 14 de septiembre de 1882, aprobatorio de la Ley de Enjuiciamiento Criminal.',
    'LIBRO I. Disposiciones generales.',
    'TÍTULO II. De la competencia de los Jueces y Tribunales en lo criminal.',
    'TÍTULO IV. De las personas a quienes corresponde el ejercicio de las acciones.',
    'TÍTULO V. Derecho a la defensa.',
    'LIBRO II. Del sumario.',
    'TÍTULO I. De la denuncia.',
    'TÍTULO III. De la Policía judicial',
    'TÍTULO VI. De la citación, de la detención y de la prisión provisional.',
    'TÍTULO VIII. De las medidas de investigación limitativas de los derechos.',
    'Bloque 3. Ley Orgánica 6/1985, de 1 de julio, del Poder Judicial.',
    'LIBRO I. De la extensión y límites de la jurisdicción.',
    'TÍTULO IV. De la composición y atribuciones de los órganos jurisdiccionales.',
    'LIBRO VII. Del Ministerio Fiscal.',
    'TÍTULO I. Del Ministerio Fiscal y la Fiscalía Europea.',
    'TÍTULO II. De los Abogados, Procuradores y Graduados Sociales.',
    'TÍTULO III. De la Policía Judicial.',
  ].join(' ')

  const LOPJ = { shortName: 'LO 6/1985', name: 'Ley Orgánica 6/1985, de 1 de julio, del Poder Judicial' }
  const LECRIM = { shortName: 'LECrim', name: 'Ley de Enjuiciamiento Criminal' }

  test('la LOPJ recibe SOLO sus cuatro títulos, no los de la LECrim', () => {
    // El bug: la LECrim se cita como "Real Decreto de 14 de septiembre de 1882,
    // aprobatorio de la Ley de Enjuiciamiento Criminal" — sin nº que la regex viera —,
    // así que sus títulos pasaban por "genéricos" y los genéricos se conceden a TODAS
    // las leyes del tema. La LOPJ heredaba [1,2,3,4,5,6,8] y sus 130 artículos fuera
    // de programa (466 preguntas) quedaban invisibles.
    expect(titlesForLaw(GC_T9, LOPJ)).toEqual({ titles: [1, 2, 3, 4], bound: true })
  })

  test('la LECrim sigue recibiendo los suyos (el fix no la deja muda)', () => {
    expect(titlesForLaw(GC_T9, LECRIM).titles).toEqual([1, 2, 3, 4, 5, 6, 8])
  })

  test('una norma del tema SIN títulos propios → bound:false (el detector se calla)', () => {
    // El RD 769/1987 enumera CAPÍTULOS, no títulos: mejor callarse que aplicarle los
    // títulos de otra norma.
    const rd = { shortName: 'RD 769/1987', name: 'Real Decreto 769/1987, sobre regulación de la Policía Judicial' }
    expect(titlesForLaw(GC_T9, rd)).toEqual({ titles: [], bound: false })
  })

  test('el nombre del código se reconoce como norma en las dos direcciones', () => {
    const ep = 'Código Penal. TÍTULO XXI. Delitos contra la Constitución. Ley 39/2015. TÍTULO IV. De los actos administrativos.'
    expect(titlesForLaw(ep, { shortName: 'CP', name: 'Código Penal' }).titles).toEqual([21])
    expect(titlesForLaw(ep, { shortName: 'Ley 39/2015', name: 'Ley 39/2015' }).titles).toEqual([4])
  })

  test('NO rompe la guarda de "Tribunal Constitucional" (regresión ya cazada una vez)', () => {
    // El `\b` tras "constitución" existe porque "Tribunal Constitucional" se leía como
    // otra norma y descartaba los títulos propios de la CE en 4 oposiciones.
    const ep = 'La Constitución Española. TÍTULO IX. Del Tribunal Constitucional.'
    expect(titlesForLaw(ep, { shortName: 'CE', name: 'Constitución Española' }).titles).toEqual([9])
  })
})

describe('epigrafeNamesRubrica — las rúbricas de plantilla no pueden eximirse solas', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { epigrafeNamesRubrica } = require('@/lib/laws/scopeTitleBoundary')

  // Epígrafe REAL de `guardia_civil` T8 (verified_literal contra el temario oficial),
  // recortado. NO menciona Hacienda, ni seguridad colectiva, ni Administración de Justicia.
  const CP_T8 = 'DERECHO PENAL. Código Penal. LIBRO I. Disposiciones generales sobre los delitos, ' +
    'las personas responsables, las penas, medidas de seguridad y demás consecuencias de la ' +
    'infracción penal. TÍTULO XIX. Delitos contra la Administración Pública. TÍTULO XXI. ' +
    'Delitos contra la Constitución.'

  test.each([
    ['De los delitos contra la Hacienda Pública y contra la Seguridad Social'],
    ['De los delitos contra la seguridad colectiva'],
  ])('NO exime «%s» (el epígrafe no la nombra)', (rubrica) => {
    // Antes: 60-67 % de solape de bolsa de palabras bastaba, porque "delitos",
    // "seguridad", "publica" y "administracion" salen por todo el epígrafe.
    expect(epigrafeNamesRubrica(CP_T8, rubrica)).toBe(false)
  })

  test('SÍ exime el título que el epígrafe nombra de verdad', () => {
    expect(epigrafeNamesRubrica(CP_T8, 'Delitos contra la Administración pública')).toBe(true)
  })

  test('sigue eximiendo el caso para el que se creó la exención (CE Título VIII)', () => {
    const ep = 'La organización territorial del Estado. Las Comunidades Autónomas.'
    expect(epigrafeNamesRubrica(ep, 'De la Organización Territorial del Estado')).toBe(true)
  })


  test('LÍMITE CONOCIDO: «Administración de Justicia» se sigue eximiendo (falso negativo aceptado)', () => {
    // Comparte la frase entera con "Delitos contra la Administración Pública" menos el
    // sustantivo final. Distinguirlo por parecido de cadenas no es fiable; queda documentado
    // para que nadie lo lea como que el detector lo cubre.
    expect(epigrafeNamesRubrica(CP_T8, 'Delitos contra la Administración de Justicia')).toBe(true)
  })

  test('tolera que la rúbrica lleve una cola que el epígrafe no repite', () => {
    // Caso real `auxiliar_administrativo_diputacion_leon` T4 (Estatuto de CyL, Título II):
    // el epígrafe dice "Instituciones de autogobierno" y la rúbrica añade "de la Comunidad".
    // La regla del ÚLTIMO token —descartada— marcaba aquí 19 artículos que el epígrafe SÍ pide.
    const ep = 'El Estatuto de Autonomía de Castilla y León: Estructura. Título Preliminar. ' +
      'Derechos y principios rectores. Instituciones de autogobierno.'
    expect(epigrafeNamesRubrica(ep, 'Instituciones de autogobierno de la Comunidad')).toBe(true)
    expect(epigrafeNamesRubrica(ep, 'Derechos y principios rectores')).toBe(true)
  })

  test('palabras compartidas pero DISPERSAS no eximen (hace falta la frase)', () => {
    const ep = 'Las competencias. La organización de los servicios. El territorio del Estado.'
    expect(epigrafeNamesRubrica(ep, 'De la Organización Territorial del Estado')).toBe(false)
  })

  test('un solo token compartido nunca exime', () => {
    expect(epigrafeNamesRubrica('El Estado y sus instituciones', 'De la Organización Territorial del Estado')).toBe(false)
  })
})

describe('epigrafeTitles — plurales, rangos y enumeraciones', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { epigrafeTitles } = require('@/lib/laws/scopeTitleBoundary')

  test('rango en palabras: «TÍTULOS del I al XII» (caso real guardia_civil T7)', () => {
    // El epígrafe oficial del Código Civil en este tema enumera el Libro I así. Sin expandir,
    // el detector daba por fuera de programa TODO el Libro I (282 artículos escopados).
    const ep = 'DERECHO CIVIL. Código Civil. TÍTULO Preliminar. LIBRO I. De las Personas. TÍTULOS del I al XII.'
    expect(epigrafeTitles(ep)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  })

  test('rango corto: «Títulos I a IV»', () => {
    expect(epigrafeTitles('Estatuto. Títulos I a IV.')).toEqual([1, 2, 3, 4])
  })

  test('enumeración en plural NO se expande como rango', () => {
    // "Títulos II, VI y VIII" son tres títulos, no del II al VIII.
    expect(epigrafeTitles('La ley: Títulos II, VI y VIII.')).toEqual([2, 6, 8])
  })

  test('el plural a secas ya no se pierde (antes daba CERO)', () => {
    expect(epigrafeTitles('Títulos I, II y III de la norma.')).toEqual([1, 2, 3])
  })

  test('el singular de siempre sigue igual', () => {
    const ep = 'TÍTULO II. De la competencia. TÍTULO IV. De las personas a quienes corresponde.'
    expect(epigrafeTitles(ep)).toEqual([2, 4])
  })

  test('no inventa títulos con palabras que parecen romanos', () => {
    // La case-sensitivity del romano es deliberada: "Título civil" no debe dar c,i,v,i,l.
    expect(epigrafeTitles('Derecho civil. Título civil de las cosas.')).toEqual([])
  })

  test('«Título I a efectos de…» no se lee como rango', () => {
    expect(epigrafeTitles('Título I a efectos de aplicación.')).toEqual([1])
  })

  test('un rango absurdo (invertido o gigante) no se expande', () => {
    expect(epigrafeTitles('Títulos del XII al I.')).toEqual([1, 12])
  })
})

describe('titulosMencionados — el romano no puede ser la inicial de una palabra', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { epigrafeTitles } = require('@/lib/laws/scopeTitleBoundary')

  test('«Título III, Capítulo II» no inventa un título 100 (la C de "Capítulo")', () => {
    // Bug real introducido al soportar enumeraciones: la coma abría la puerta a leer la
    // inicial de la palabra siguiente como numeral romano. C = 100.
    expect(epigrafeTitles('Título III, Capítulo II. De los actos.')).toEqual([3])
  })

  test('«Título V, Capítulo I y Capítulo III» → solo el V', () => {
    expect(epigrafeTitles('Título V, Capítulo I y Capítulo III.')).toEqual([5])
  })
})

describe('epigrafeTitles — enumeraciones reales de epígrafes autonómicos', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { epigrafeTitles } = require('@/lib/laws/scopeTitleBoundary')

  test('«preliminar» NO corta la lista (bug propio: devolvía solo [0])', () => {
    // Caso real de la Ley 39/2015 en 5 oposiciones (Galicia, Asturias, Univ. León). Al leer
    // solo [0] el detector daba por fuera de programa los Títulos I-V — 50 artículos por
    // scope, todos falsos positivos.
    expect(epigrafeTitles('Ley 39/2015: títulos preliminar, I, II, III, IV y V.')).toEqual([0, 1, 2, 3, 4, 5])
  })

  test('«e» como conjunción: «títulos preliminar e I»', () => {
    expect(epigrafeTitles('Ley 9/2007 de subvenciones de Galicia: títulos preliminar e I.')).toEqual([0, 1])
  })

  test('salta el paréntesis que acota capítulos y sigue la enumeración', () => {
    // Ley 7/2023 de Galicia. Sin saltarlo, la lista moría en el II y los Títulos VII y VIII
    // —pedidos— salían como fuera de programa. Los capítulos del paréntesis NO se leen como
    // títulos: el detector razona por título, y permitir el título entero es el lado seguro.
    const ep = 'Ley 7/2023: títulos preliminar, I, II (capítulos I, II, y XI), VII y VIII.'
    expect(epigrafeTitles(ep)).toEqual([0, 1, 2, 7, 8])
  })

  test('«capítulo I del título III» cuenta el título III como presente', () => {
    const ep = 'Ley 16/2010: títulos preliminar, I, II y capítulo I del título III.'
    expect(epigrafeTitles(ep)).toEqual([0, 1, 2, 3])
  })

  test('enumeración con saltos: «Títulos VII, VIII, X y XI»', () => {
    expect(epigrafeTitles('Ley 7/1985. Títulos VII, VIII, X y XI.')).toEqual([7, 8, 10, 11])
  })
})

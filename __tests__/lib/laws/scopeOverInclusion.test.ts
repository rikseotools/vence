// __tests__/lib/laws/scopeOverInclusion.test.ts
// Unit del detector de SOBRE-INCLUSIÓN de topic_scope (gap cazado por Luisa /
// Aux. Admvo. SMS T11, 21/07 — el epígrafe enumera 4 bloques pero el scope tenía
// la ley entera, y verify:scope lo dio en FALSO VERDE).
import { readFileSync } from 'fs'
import { classifyScope, parseEpigrafe, romanToInt } from '@/lib/laws/scopeOverInclusion'

describe('romanToInt', () => {
  it('convierte romanos', () => {
    expect(romanToInt('I')).toBe(1)
    expect(romanToInt('IV')).toBe(4)
    expect(romanToInt('IX')).toBe(9)
    expect(romanToInt('II.bis')).toBe(2)
  })
})

describe('parseEpigrafe', () => {
  it('cuenta segmentos por ; y por , tras el colon (frases reales, >=4 letras)', () => {
    const f = parseEpigrafe('Ley X: atención sanitaria; intimidad; deberes generales.')
    expect(f.segments).toBe(3)
    const g = parseEpigrafe('Ley X: principios rectores, medidas preventivas, detección; derechos.')
    expect(g.segments).toBe(4)
  })
  it('detecta huecos de títulos (nombra II y IV, salta III)', () => {
    const f = parseEpigrafe('Estatuto: Título I; Título II; Título IV.')
    expect(f.titSet).toEqual([1, 2, 4])
    expect(f.titGap).toBe(true)
  })
  it('secuencia completa de títulos → sin hueco', () => {
    const f = parseEpigrafe('Estatuto: Título Preliminar; Título I; Título II.')
    expect(f.titSet).toEqual([0, 1, 2])
    expect(f.titComplete).toBe(true)
  })
  it('extrae artículos citados explícitamente', () => {
    const f = parseEpigrafe('LO 3/2007: los planes (arts. 45 a 49); criterios (art. 51).')
    expect(f.explicitArts.has(45)).toBe(true)
    expect(f.explicitArts.has(49)).toBe(true)
    expect(f.explicitArts.has(51)).toBe(true)
  })
})

// Fixtures etiquetados (ground-truth). `expect` = ¿debe marcarse SOSPECHOSO?
const FIXTURES: Array<{ name: string; expect: boolean; lawTotal: number; scopedCount: number; epigrafe: string }> = [
  { name: 'T11 real (3 bloques subset, ley entera)', expect: true, lawTotal: 73, scopedCount: 73,
    epigrafe: 'Ley 3/2009: derechos relacionados con la atención y asistencia sanitaria; derechos en relación a la intimidad y a la confidencialidad; derechos en materia de información y participación sanitaria; deberes.' },
  { name: 'Estatuto monográfico (todos los títulos + reforma)', expect: false, lawTotal: 54, scopedCount: 54,
    epigrafe: 'El Estatuto de Autonomía: Título Preliminar; competencias (Título I); órganos institucionales (Título II); Administración de Justicia (Título III); Hacienda (Título IV); control (Título V); reforma' },
  { name: 'Ya estrechado correctamente (cobertura baja)', expect: false, lawTotal: 73, scopedCount: 23,
    epigrafe: 'Ley 3/2009: atención y asistencia; intimidad y confidencialidad; información y participación; deberes.' },
  { name: 'Ley pequeña scopeada entera (normal)', expect: false, lawTotal: 6, scopedCount: 6,
    epigrafe: 'Ley X: objeto; ámbito; principios.' },
  { name: 'Whole-law sin enumeración (no decidible → no marcar)', expect: false, lawTotal: 90, scopedCount: 90,
    epigrafe: 'La Ley 39/2015 del Procedimiento Administrativo Común.' },
  { name: 'Declara íntegra explícitamente', expect: false, lawTotal: 50, scopedCount: 50,
    epigrafe: 'Ley Y en su totalidad: disposiciones generales; procedimiento; régimen.' },
  { name: 'Título con hueco (nombra II y IV, salta III)', expect: true, lawTotal: 251, scopedCount: 251,
    epigrafe: 'Estatuto: Título Preliminar; Título I; Título II (salud); y Título IV (organización institucional).' },
  { name: 'Epígrafe cita arts. 45 a 49 y 51 pero scope 77', expect: true, lawTotal: 79, scopedCount: 77,
    epigrafe: 'LO 3/2007: objeto (Título Preliminar); tutela (Título I); los planes de igualdad (arts. 45 a 49); criterios de las AAPP (art. 51).' },
  { name: 'Frontera cobertura 0.9 ley mediana', expect: true, lawTotal: 20, scopedCount: 18,
    epigrafe: 'Ley Z: bloque uno; bloque dos; bloque tres.' },
  { name: 'Frontera cobertura 0.85 (por debajo)', expect: false, lawTotal: 20, scopedCount: 17,
    epigrafe: 'Ley Z: bloque uno; bloque dos; bloque tres.' },
  { name: 'SERMAS LO 1/2004 (enumeración por COMAS, ley entera)', expect: true, lawTotal: 73, scopedCount: 73,
    epigrafe: 'La LO 1/2004 contra la Violencia de Género: principios rectores, medidas de sensibilización, prevención y detección en el ámbito sanitario; derechos de las funcionarias públicas.' },
  { name: 'Generico con coma pero SIN colon (no marcar)', expect: false, lawTotal: 90, scopedCount: 90,
    epigrafe: 'La Ley 39/2015, del Procedimiento Administrativo Común de las Administraciones Públicas.' },
  // ── Banda "materia acotada en prosa" (26/07/2026) ────────────────────────────
  // Origen: el RGPD tenía 54 artículos sin preguntas y parecía trabajo de
  // generación; era scope de más. Tres oposiciones escopaban sus 99 artículos
  // para epígrafes que piden una porción. No citan artículos, no nombran títulos
  // y no llegan a 3 segmentos tras el colon: las reglas anteriores daban NONE.
  { name: 'RGPD real: 99/99 para "Conceptos y Principios"', expect: true, lawTotal: 99, scopedCount: 99,
    epigrafe: 'El régimen jurídico de la protección de datos de carácter personal: regulación. Conceptos y Principios en el tratamiento de los datos personales.' },
  { name: 'RGPD real: 99/99 para "disposiciones generales"', expect: true, lawTotal: 99, scopedCount: 99,
    epigrafe: 'Protección de Datos de Carácter Personal: disposiciones generales. Datos especialmente protegidos.' },
  { name: 'Ley 2/2006 CyL: 301/301 para "Concepto y estructura"', expect: true, lawTotal: 301, scopedCount: 301,
    epigrafe: 'El presupuesto de la Comunidad de Castilla y León. Concepto y estructura. Fases del ciclo presupuestario.' },
  // El corte por TAMAÑO es lo que separa señal de ruido: en una norma pequeña, la
  // materia acotada ES la norma entera. Medido sobre el banco: sin corte salen 33
  // candidatos y la muestra mezcla; con corte a 60 arts quedan 18 del patrón bueno.
  { name: 'Norma pequeña scopeada entera para un "concepto" (legítimo)', expect: false, lawTotal: 22, scopedCount: 22,
    epigrafe: 'El archivo. Concepto. Tipos de archivos. Organización del archivo.' },
  { name: 'Ley por debajo del corte de 60 arts', expect: false, lawTotal: 40, scopedCount: 40,
    epigrafe: 'La norma: concepto y principios generales.' },
  { name: 'Ley muy grande YA estrechada (cobertura baja) pese a epígrafe que acota', expect: false, lawTotal: 99, scopedCount: 20,
    epigrafe: 'Protección de datos: conceptos y principios.' },
  // ── Enumeraciones escritas con PUNTOS (T-137, 31/07/2026) ────────────────────
  // La regla de enumerador exigía dos puntos y partía por ";"/"," — pero la forma
  // habitual de enumerar en un temario es con PUNTOS, y esos epígrafes daban NONE.
  // Caso REAL que abrió la ficha: el tema escopa los 69 artículos de la Ley 22/2009
  // (incluida toda la maquinaria de gestión de tributos cedidos) para un epígrafe
  // que pide tres materias, una de ellas «el actual modelo de financiación».
  { name: 'T-137 real: Ley 22/2009 entera para 3 materias separadas por PUNTOS', expect: true, lawTotal: 69, scopedCount: 69,
    epigrafe: 'Generalidades. Las normas de atribución y delimitación de las competencias. El actual modelo de financiación de las comunidades autónomas de régimen común.' },
  // El artefacto que obligó a descontar la cita: partir por puntos y comas convierte
  // el NOMBRE de la ley en «segmentos» («La Ley 19/2013» · «de 9 de diciembre» ·
  // «de transparencia» · «acceso a la información…»), así que un epígrafe que se
  // limita a citar la norma pasaría por enumerador. Medido: 72 filas de ruido.
  { name: 'Solo la CITA de la norma, sin enumerar materias (no marcar)', expect: false, lawTotal: 99, scopedCount: 99,
    epigrafe: 'La Ley Orgánica 3/2018, de 5 de diciembre, de Protección de Datos Personales y garantía de los derechos digitales.' },
  { name: 'Cita de la norma + fecha, ley grande entera (no marcar)', expect: false, lawTotal: 80, scopedCount: 80,
    epigrafe: 'Real Decreto Legislativo 5/2015, de 30 de octubre, por el que se aprueba el texto refundido del Estatuto Básico del Empleado Público.' },
  // El suelo de 60 arts para el PUNTO: por debajo, la materia acotada ES la norma
  // entera. Sin él, el fixture del archivo (22 arts) pasaría a sospechoso.
  { name: 'Enumeración por puntos en norma de 40 arts (por debajo del suelo, legítimo)', expect: false, lawTotal: 40, scopedCount: 40,
    epigrafe: 'El registro. Concepto. Clases de registro. Organización del registro.' },
]

describe('classifyScope — casos etiquetados', () => {
  for (const fx of FIXTURES) {
    it(`${fx.expect ? 'SOSPECHOSO' : 'limpio'}: ${fx.name}`, () => {
      const r = classifyScope(fx)
      expect(r.suspect).toBe(fx.expect)
    })
  }

  it('el caso T11 real cae en banda MEDIUM (prosa, sin títulos ni arts citados)', () => {
    const r = classifyScope(FIXTURES[0])
    expect(r.band).toBe('MEDIUM')
  })

  it('el hueco-de-título es banda HIGH (accionable)', () => {
    const r = classifyScope(FIXTURES[6])
    expect(r.band).toBe('HIGH')
  })

  it('los arts citados con scope >> es banda HIGH', () => {
    const r = classifyScope(FIXTURES[7])
    expect(r.band).toBe('HIGH')
  })
})

// El sweep (scripts/health-sweep.cjs) lleva un MIRROR inline de classifyScope
// porque la imagen standalone no incluye lib/*.ts. Este test extrae ese mirror y
// verifica que NO diverge de la lib (una divergencia silenciosa ya ocurrió: un
// regex con prefijo cirílico + flag `i` casaba "capÍTULO" como "Título").
// TERCERA copia (descubierta el 26/07/2026): `scripts/scope-over-inclusion.cjs`
// —el CLI de scan/suspects/record— NO importa la lib: lleva su propio
// `classifyScope` inline. El guardarraíl solo vigilaba lib ↔ sweep, así que al
// añadir la banda de "materia acotada" quedaron DOS actualizadas y una vieja, y
// el scan seguía dando los números de antes sin avisar de nada. Un criterio con
// tres implementaciones y dos vigiladas es peor que uno con dos: da falsa
// sensación de cobertura.
describe('CLI scope-over-inclusion.cjs ↔ lib (sync)', () => {
  const src = readFileSync('scripts/scope-over-inclusion.cjs', 'utf-8')
  const a = src.indexOf('const ROMAN =')
  const b = src.indexOf('const FIXTURES =')
  it('el bloque del clasificador existe en el CLI', () => {
    expect(a).toBeGreaterThan(-1)
    expect(b).toBeGreaterThan(a)
  })
  // eslint-disable-next-line no-eval
  const cli: (i: { lawTotal: number; scopedCount: number; epigrafe: string }) => { band: string } = eval(
    src.slice(a, b) + '\n(classifyScope)',
  )
  for (const fx of FIXTURES) {
    it(`CLI == lib: ${fx.name}`, () => {
      expect(cli({ lawTotal: fx.lawTotal, scopedCount: fx.scopedCount, epigrafe: fx.epigrafe }).band).toBe(
        classifyScope(fx).band,
      )
    })
  }
})

// ── NULL = toda la ley: la decisión vive en los RUNNERS, no en classifyScope ──
// `classifyScope` recibe `scopedCount` ya calculado, así que el mapeo
// "article_numbers IS NULL → scopedCount = lawTotal" queda FUERA del núcleo puro y
// las fixtures de arriba no lo cubren. Contarlo como 0 (el bug hasta el 26/07)
// dejaba el 32% de los scopes —1.925 de 5.925— invisibles al detector, y ahí
// estaban casos reales: Guardia Civil T9 con los 930 artículos de la LECrim, o
// tcae_sescam T4 con los 55 de la LPRL para un epígrafe que solo pide dos
// capítulos. Este test no comprueba lógica: comprueba que las DOS
// implementaciones siguen tratando el NULL igual, que es donde se rompería en
// silencio (el sweep alimenta el badge; el CLI, la cola de adjudicación).
// El badge tiene que poder BAJAR. El kind `scope_over_inclusion_suspect` no
// consultaba `scope_over_inclusion_adjudications`, asi que seguia contando casos ya
// adjudicados —incluidos los recortados horas antes—. Un forcing-function que no se
// puede satisfacer deja de ser señal. Este test fija que el sweep excluye los
// adjudicados `ok` (falso positivo O recorte ya aplicado) y NO los `over_inclusion`,
// que son trabajo pendiente y deben seguir pesando.
describe('el badge respeta las adjudicaciones', () => {
  const SWEEP = readFileSync('scripts/health-sweep.cjs', 'utf-8')
  // El @Cron del backend es el writer PROGRAMADO real de content_health_findings; el sweep
  // CLI es su gemelo manual. Hasta el 31/07 estos asserts solo miraban al gemelo, así que la
  // guarda llegó al CLI el 26/07 y el writer real se quedó cinco días con el criterio viejo
  // sin que nada lo dijera. El test de paridad tampoco podía verlo: compara los `kind` que
  // emite cada fichero, no la LÓGICA con que los emite. Medido al arreglarlo: el CLI daba 0
  // hallazgos y el @Cron 2, y los 2 eran casos ya adjudicados `ok` — hallazgos que el panel
  // no podía bajar hiciera lo que hiciera nadie. Un badge que no puede llegar a cero deja de
  // leerse. Por eso los asserts van contra los DOS. [T-088]
  const BACKEND = readFileSync('backend/src/content-health-sweep/content-health-sweep.service.ts', 'utf-8')

  it('el sweep consulta la tabla de adjudicaciones', () => {
    expect(SWEEP).toContain('scope_over_inclusion_adjudications')
  })

  it('el backend @Cron (writer real) también la consulta', () => {
    expect(BACKEND).toContain('scope_over_inclusion_adjudications')
  })

  it('excluye los adjudicados como ok', () => {
    expect(/NOT EXISTS[\s\S]{0,400}scope_over_inclusion_adjudications[\s\S]{0,200}verdict\s*=\s*'ok'/.test(SWEEP)).toBe(true)
  })

  it('el backend @Cron también excluye los adjudicados como ok', () => {
    expect(/NOT EXISTS[\s\S]{0,400}scope_over_inclusion_adjudications[\s\S]{0,200}verdict\s*=\s*'ok'/.test(BACKEND)).toBe(true)
  })

  it('NO excluye los adjudicados como over_inclusion (siguen siendo trabajo pendiente)', () => {
    const bloque = SWEEP.slice(SWEEP.indexOf('scope_over_inclusion_adjudications') - 900, SWEEP.indexOf('scope_over_inclusion_adjudications') + 400)
    expect(bloque).not.toMatch(/verdict\s*(=|IN)\s*[^']*over_inclusion/)
  })
})

describe('NULL = toda la ley (sweep ↔ CLI ↔ backend @Cron, sin divergencia)', () => {
  const SWEEP = readFileSync('scripts/health-sweep.cjs', 'utf-8')
  const CLI = readFileSync('scripts/scope-over-inclusion.cjs', 'utf-8')
  const BACKEND = readFileSync('backend/src/content-health-sweep/content-health-sweep.service.ts', 'utf-8')
  // Acepta cualquier formato razonable: lo que se exige es que el NULL se
  // resuelva a law_total y NO a 0.
  const trataNull = (src: string) =>
    /article_numbers\s*===\s*null[\s\S]{0,120}law_total/.test(src)

  it('el sweep resuelve article_numbers NULL a law_total', () => {
    expect(trataNull(SWEEP)).toBe(true)
  })

  it('el CLI resuelve article_numbers NULL a law_total', () => {
    expect(trataNull(CLI)).toBe(true)
  })

  // El writer REAL es éste, y era el único que seguía contando "toda la ley" como cero
  // artículos: 1.924 de 5.964 scopes (32%) invisibles al detector en el @Cron nocturno. [T-088]
  it('el backend @Cron resuelve article_numbers NULL a law_total', () => {
    expect(trataNull(BACKEND)).toBe(true)
  })

  it('ninguno vuelve al patrón `(article_numbers || [])` para contar la cobertura', () => {
    // Ese patrón es exactamente el bug: convierte "toda la ley" en "cero artículos".
    const patronBug = /const\s+scoped(Count)?\s*=\s*\(r\.article_numbers\s*\|\|\s*\[\]\)/
    expect(patronBug.test(SWEEP)).toBe(false)
    expect(patronBug.test(CLI)).toBe(false)
    expect(patronBug.test(BACKEND)).toBe(false)
  })
})

describe('sweep mirror ↔ lib (sync)', () => {
  const src = readFileSync('scripts/health-sweep.cjs', 'utf-8')
  const a = src.indexOf('const romanToInt = (s) =>')
  const b = src.indexOf('const overIncl =')
  it('el bloque mirror existe en el sweep', () => {
    expect(a).toBeGreaterThan(-1)
    expect(b).toBeGreaterThan(a)
  })
  // eslint-disable-next-line no-eval
  const mirror: (lt: number, sc: number, ep: string) => { band: string } = eval(
    src.slice(a, b) + '\n(classifyScope)',
  )
  for (const fx of FIXTURES) {
    it(`mirror == lib: ${fx.name}`, () => {
      const lib = classifyScope(fx)
      const mir = mirror(fx.lawTotal, fx.scopedCount, fx.epigrafe)
      expect(mir.band).toBe(lib.band)
    })
  }
})

// El WRITER REAL de content_health_findings es el @Cron del backend, no el gemelo CLI — y llevaba
// su propia copia de classifyScope que NADIE contrastaba: el bloque de arriba solo miraba a
// scripts/health-sweep.cjs y el test de paridad compara los `kind` que emite cada fichero, no la
// lógica. Resultado medido el 31/07 [T-088]: el backend pasó cinco días con el criterio viejo y
// emitía 2 hallazgos que el CLI ya no daba. La tercera copia se contrasta ahora contra las mismas
// fixtures que las otras dos.
describe('backend @Cron mirror ↔ lib (sync)', () => {
  const src = readFileSync('backend/src/content-health-sweep/content-health-sweep.service.ts', 'utf-8')
  const a = src.indexOf('function romanToInt(')
  const b = src.indexOf('// Mirror INLINE de lib/convocatoria/linkCoherence.cjs', a)

  it('el bloque mirror existe en el backend', () => {
    expect(a).toBeGreaterThan(-1)
    expect(b).toBeGreaterThan(a)
  })

  // Se COMPILA el TypeScript del mirror en vez de quitarle los tipos con regex: el primer intento
  // lo hizo a mano y se atragantó con `string | null`. Es una función pura de (lawTotal,
  // scopedCount, epigrafe) que no depende de nada del módulo salvo romanToInt, así que compilar
  // ese trozo y evaluarlo es fiel y no obliga a mantener una lista de patrones de tipo.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ts = require('typescript')
  const js = ts.transpileModule(src.slice(a, b), {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText
  // eslint-disable-next-line no-eval
  const mirror: (lt: number, sc: number, ep: string) => { band: string } = eval(js + '\n(classifyScope)')

  for (const fx of FIXTURES) {
    it(`backend mirror == lib: ${fx.name}`, () => {
      expect(mirror(fx.lawTotal, fx.scopedCount, fx.epigrafe).band).toBe(classifyScope(fx).band)
    })
  }
})

describe('consensoBanco — ¿tener la ley ENTERA es la anomalía o la norma?', () => {
  const { consensoBanco } = require('@/lib/laws/scopeOverInclusion')

  test('caso que la estrenó: LOPJ, 2 enteros de 40 temas → ANOMALÍA', () => {
    // `administrativo_seguridad_social` T6 tenía la LOPJ completa (666 arts) con un epígrafe en
    // prosa. Los otros 38 temas la acotaban; dos oposiciones estatales con epígrafe casi
    // idéntico, a 75 y 73 artículos.
    const v = consensoBanco({ temas: 40, enteros: 2, medianaAcotados: 24 })
    expect(v.senal).toBe('anomalia')
    expect(v.motivo).toMatch(/EXCEPCIÓN/)
    expect(v.motivo).toMatch(/~24 arts/)   // la referencia de tamaño es parte del valor
  })

  test('cuando la ley entera es lo HABITUAL, no acusa', () => {
    // Estatuto de Autonomía de Madrid: 4 de 7 temas lo tienen entero. Un tema sobre "el Estatuto:
    // estructura y contenido" que recorre toda la norma es normal.
    expect(consensoBanco({ temas: 7, enteros: 4, medianaAcotados: 60 }).senal).toBe('norma')
  })

  test('con pocos temas comparables NO se moja', () => {
    // Reglamento de la Asamblea de Madrid: 3 temas en todo el banco. Una señal que opina sin
    // datos es peor que ninguna.
    const v = consensoBanco({ temas: 3, enteros: 1, medianaAcotados: 182 })
    expect(v.senal).toBe('insuficiente')
    expect(v.motivo).toMatch(/no hay con qué comparar/)
  })

  test('reparto ambiguo → insuficiente, no anomalía', () => {
    expect(consensoBanco({ temas: 10, enteros: 4, medianaAcotados: 30 }).senal).toBe('insuficiente')
  })

  test('sin ninguno acotado, la señal no promete un tamaño de referencia', () => {
    const v = consensoBanco({ temas: 8, enteros: 2, medianaAcotados: null })
    expect(v.senal).toBe('anomalia')
    expect(v.motivo).not.toMatch(/arts/)
  })

  test('umbrales configurables sin tocar la lógica', () => {
    expect(consensoBanco({ temas: 4, enteros: 1, medianaAcotados: 10 }, { minTemas: 4 }).senal).toBe('anomalia')
  })

  // Dos copias del clasificador que se desincronicen valen menos que una: el CLI es el que usa
  // el runbook, así que si divergen, el humano adjudica con una señal distinta de la testeada.
  // Se extrae el mirror del FICHERO y se evalúa (mismo patrón que los otros mirrors de este
  // test); no se puede `require` el .cjs porque arranca dotenv y CLI al cargarse.
  describe('MIRROR del CLI ↔ lib (sync)', () => {
    const src = readFileSync('scripts/scope-over-inclusion.cjs', 'utf-8')

    it('el bloque mirror existe en el CLI', () => {
      expect(src).toMatch(/function consensoBanco\(\{ temas, enteros, medianaAcotados \}, opts\)/)
    })

    const ini = src.indexOf('function consensoBanco(')
    const fin = src.indexOf('\n}', ini) + 2
    // eslint-disable-next-line no-eval
    const mirror = eval(`(${src.slice(ini, fin).replace('function consensoBanco', 'function')})`)

    for (const caso of [
      { temas: 40, enteros: 2, medianaAcotados: 24 },
      { temas: 7, enteros: 4, medianaAcotados: 60 },
      { temas: 3, enteros: 1, medianaAcotados: null },
      { temas: 10, enteros: 4, medianaAcotados: 30 },
      { temas: 8, enteros: 2, medianaAcotados: null },
    ]) {
      it(`mirror == lib: ${JSON.stringify(caso)}`, () => {
        expect(mirror(caso)).toEqual(consensoBanco(caso))
      })
    }
  })
})

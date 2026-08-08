// officialCountSingleSource.test.ts
//
// Blindaje de la CLASE DE BUG del "conteo de oficiales" (07/06/2026):
// el label del configurador mostraba 115 oficiales en Seg. Social T3 ("Tribunal
// Constitucional") cuando lo real eran ~1 — porque `topic-data` contaba TODAS
// las oficiales del scope (cualquier oposición) con un `filter(q.isOfficialExam)`
// a pelo, en vez de filtrar por exam_position como hace la generación
// (buildOfficialExamFilter, casos Laura/Sergio).
//
// FUENTE ÚNICA: "qué cuenta como oficial de esta oposición" se decide en UN solo
// sitio — getValidExamPositions(positionType) → buildOfficialExamFilter (SQL) /
// ownOfficialPredicate (JS, conteos en memoria). Este test:
//   1) verifica la semántica del predicado JS, y
//   2) GUARD estático: impide que topic-data vuelva a contar oficiales sin pasar
//      por la fuente única (regresión exacta del bug).

import fs from 'fs'
import path from 'path'
import { ownOfficialPredicate, passesOfficialExamFilter } from '@/lib/api/oposicion-scope/queries'

describe('ownOfficialPredicate — fuente única de conteo de oficiales (JS)', () => {
  // auxiliar_administrativo_estado está mapeada en EXAM_POSITION_MAP.
  const isOwn = ownOfficialPredicate('auxiliar_administrativo_estado')

  it('cuenta la oficial cuyo exam_position es de la propia oposición', () => {
    expect(isOwn({ isOfficialExam: true, examPosition: 'auxiliar_administrativo_estado' })).toBe(true)
  })

  it('NO cuenta la oficial de OTRA oposición (anti-contaminación)', () => {
    expect(isOwn({ isOfficialExam: true, examPosition: 'administrativo_estado' })).toBe(false)
  })

  it('NO cuenta preguntas no oficiales aunque el exam_position coincida', () => {
    expect(isOwn({ isOfficialExam: false, examPosition: 'auxiliar_administrativo_estado' })).toBe(false)
    expect(isOwn({ isOfficialExam: null, examPosition: 'auxiliar_administrativo_estado' })).toBe(false)
  })

  it('NO cuenta oficiales con exam_position nulo', () => {
    expect(isOwn({ isOfficialExam: true, examPosition: null })).toBe(false)
  })

  it('oposición sin posiciones válidas → NINGUNA oficial cuenta', () => {
    const isOwnUnmapped = ownOfficialPredicate('__oposicion_inexistente__')
    expect(isOwnUnmapped({ isOfficialExam: true, examPosition: 'lo_que_sea' })).toBe(false)
  })

  it('reproduce el bug del 115: una oficial de CE de OTRA oposición no cuenta como propia', () => {
    // Mezcla realista: 1 propia + varias cross-oposición sobre ley compartida (CE).
    const rows = [
      { isOfficialExam: true, examPosition: 'auxiliar_administrativo_estado' }, // propia
      { isOfficialExam: true, examPosition: 'administrativo_estado' }, // cross
      { isOfficialExam: true, examPosition: 'guardia_civil' }, // cross
      { isOfficialExam: true, examPosition: 'tramitacion_procesal' }, // cross
      { isOfficialExam: false, examPosition: 'auxiliar_administrativo_estado' }, // no oficial
    ]
    expect(rows.filter(isOwn).length).toBe(1)
  })

  // ── T-597 (08/08): el gemelo de conteo se había quedado atrás del filtro SQL ─────────────
  // buildOfficialExamFilter (SQL) ya admitía cualquier oficial para una personalizada desde
  // el 07/08, pero este predicado JS —la fuente única del label 🏛️ y de mv-queries— seguía
  // usando getValidExamPositions a pelo: para una personalizada eso es SIEMPRE [], así que
  // CUALQUIER oficial (incluida la propia, si existiera) contaba como "ajena". Medido contra
  // RDS el 08/08: 518 oficiales servibles en la personalizada de Sergio, 0 anunciadas.
  it('una personalizada cuenta CUALQUIER oficial como propia (antes: ninguna, aunque el serve ya las admitía)', () => {
    const isOwnPersonalizada = ownOfficialPredicate('personalizada_a92faefaf41b4d36b723c274f90a59f7')
    expect(isOwnPersonalizada({ isOfficialExam: true, examPosition: 'guardia_civil' })).toBe(true)
    expect(isOwnPersonalizada({ isOfficialExam: true, examPosition: 'auxiliar_administrativo_estado' })).toBe(true)
    expect(isOwnPersonalizada({ isOfficialExam: false, examPosition: 'guardia_civil' })).toBe(false)
    // Sin restricción de exam_position (a diferencia del caso mapeado): buildOfficialExamFilter
    // tampoco distingue por exam_position para una personalizada, así que ni siquiera un
    // examPosition null excluye la oficial — solo importa is_official_exam.
    expect(isOwnPersonalizada({ isOfficialExam: true, examPosition: null })).toBe(true)
  })

  it('una oposición REAL sin mapeo sigue sin contar ninguna (el caso Laura no se relaja)', () => {
    const isOwnUnmapped = ownOfficialPredicate('oposicion_inexistente_xyz')
    expect(isOwnUnmapped({ isOfficialExam: true, examPosition: 'guardia_civil' })).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// LA OTRA MITAD DEL MISMO CRITERIO (T-507, 03/08/2026)
//
// El bug del 115 era contar de MÁS las oficiales PROPIAS. Su gemelo es contar
// como disponibles las AJENAS: el serve aplica siempre buildOfficialExamFilter,
// así que una oficial de otra oposición NUNCA sale en un test — pero los
// contadores la sumaban igual. subalterno_gva tema 3 anunciaba 39 preguntas y
// servía 22 (17 oficiales de auxiliar_administrativo_valencia); la usuaria veía
// "las mismas todo el rato" y un rótulo que prometía más.
// ─────────────────────────────────────────────────────────────────────────────
describe('passesOfficialExamFilter — lo que el serve puede DAR (gemelo JS del filtro SQL)', () => {
  const sirve = passesOfficialExamFilter('auxiliar_administrativo_estado')

  it('deja pasar cualquier pregunta NO oficial', () => {
    expect(sirve({ isOfficialExam: false, examPosition: null })).toBe(true)
    expect(sirve({ isOfficialExam: null, examPosition: null })).toBe(true)
    // ...incluso si arrastra un exam_position de otra oposición (dato residual)
    expect(sirve({ isOfficialExam: false, examPosition: 'guardia_civil' })).toBe(true)
  })

  it('deja pasar la oficial de la PROPIA oposición', () => {
    expect(sirve({ isOfficialExam: true, examPosition: 'auxiliar_administrativo_estado' })).toBe(true)
  })

  it('DESCARTA la oficial de otra oposición (es la que el serve nunca da)', () => {
    expect(sirve({ isOfficialExam: true, examPosition: 'administrativo_estado' })).toBe(false)
    expect(sirve({ isOfficialExam: true, examPosition: null })).toBe(false)
  })

  it('oposición sin mapeo → NINGUNA oficial es servible (subalterno_gva)', () => {
    const sirveGva = passesOfficialExamFilter('subalterno_gva')
    expect(sirveGva({ isOfficialExam: true, examPosition: 'auxiliar_administrativo_valencia' })).toBe(false)
    expect(sirveGva({ isOfficialExam: false, examPosition: null })).toBe(true)
  })

  // T-597 (08/08): passesOfficialExamFilter deriva de ownOfficialPredicate, así que hereda
  // el fix sin tocarse — pero se fija aquí explícitamente porque es la función que
  // topic-data usa para totalQuestions/difficultyStats en el camino sin MV.
  it('una personalizada admite CUALQUIER oficial (antes: las descartaba todas, igual que una oposición sin mapear)', () => {
    const sirvePersonalizada = passesOfficialExamFilter('personalizada_a92faefaf41b4d36b723c274f90a59f7')
    expect(sirvePersonalizada({ isOfficialExam: true, examPosition: 'guardia_civil' })).toBe(true)
    expect(sirvePersonalizada({ isOfficialExam: true, examPosition: 'auxiliar_administrativo_madrid' })).toBe(true)
    expect(sirvePersonalizada({ isOfficialExam: false, examPosition: null })).toBe(true)
  })

  it('es EXACTAMENTE la negación de "oficial ajena" (no se pueden desincronizar)', () => {
    const esPropia = ownOfficialPredicate('auxiliar_administrativo_estado')
    const casos = [
      { isOfficialExam: true, examPosition: 'auxiliar_administrativo_estado' },
      { isOfficialExam: true, examPosition: 'administrativo_estado' },
      { isOfficialExam: true, examPosition: null },
      { isOfficialExam: false, examPosition: 'auxiliar_administrativo_estado' },
      { isOfficialExam: null, examPosition: null },
    ]
    for (const q of casos) {
      const esAjena = q.isOfficialExam === true && !esPropia(q)
      expect(sirve(q)).toBe(!esAjena)
    }
  })

  it('reproduce el caso de Neus: 39 en el scope, 22 servibles', () => {
    const sirveGva = passesOfficialExamFilter('subalterno_gva')
    const scopeTema3 = [
      ...Array.from({ length: 22 }, () => ({ isOfficialExam: false, examPosition: null })),
      ...Array.from({ length: 17 }, () => ({
        isOfficialExam: true,
        examPosition: 'auxiliar_administrativo_valencia',
      })),
    ]
    expect(scopeTema3.length).toBe(39)
    expect(scopeTema3.filter(sirveGva).length).toBe(22)
  })
})

describe('GUARD: ningún CONTADOR anuncia lo que el serve no sirve', () => {
  // Los cuatro sitios que producen un número de "preguntas disponibles" que el
  // opositor ve en pantalla. Todos DEBEN aplicar el mismo filtro de oficiales que
  // aplica el serve; si uno se olvida, vuelve a prometer preguntas inexistentes.
  //   · mv-queries      → tarjeta del hub + ficha del tema (camino vivo)
  //   · topic-data      → ficha del tema (fallback sin MV)
  //   · random-test     → tarjeta del hub (fallback sin MV)
  //   · test-config     → "N preguntas disponibles con tu configuración"
  const contadores = [
    'lib/api/topic-data/mv-queries.ts',
    'lib/api/topic-data/queries.ts',
    'lib/api/random-test/queries.ts',
    'lib/api/test-config/queries.ts',
    // El GATE que decide si un tema se puede publicar es un contador más, y por contar el scope
    // en vez de lo servible dio ✅ a un tema disponible que sirve 0 (Parque Móvil T11, T-522).
    'scripts/audit-oposicion-completa.ts',
  ]

  for (const file of contadores) {
    it(`${file} descuenta las oficiales que el serve no sirve`, () => {
      const src = fs.readFileSync(path.join(process.cwd(), file), 'utf8')
      // Vale cualquiera de las dos formas de tener el criterio: aplicar el filtro compartido,
      // o —mejor— preguntarle directamente a la función que sirve.
      const aplicaElFiltro =
        /buildOfficialExamFilter|passesOfficialExamFilter|ajenas|getFilteredQuestions/i.test(src)
      expect(aplicaElFiltro).toBe(true)
    })

    it(`${file} deja constancia de POR QUÉ (referencia a T-507)`, () => {
      // Un descuento sin explicación se borra en la siguiente refactorización
      // "simplificadora". La referencia es lo que permite recuperar el motivo.
      const src = fs.readFileSync(path.join(process.cwd(), file), 'utf8')
      expect(src).toMatch(/T-507/)
    })
  }
})

describe('GUARD: topic-data NO cuenta oficiales sin la fuente única', () => {
  // Los 2 ficheros que producen `officialQuestionsCount` (el label del
  // configurador). Si alguien vuelve a contar oficiales a pelo aquí, el bug
  // del 115 reaparece. Cada uno DEBE derivar de la fuente única.
  const targets: Array<{ file: string; mustReference: RegExp }> = [
    {
      file: 'lib/api/topic-data/queries.ts',
      mustReference: /ownOfficialPredicate|buildOfficialExamFilter|getValidExamPositions/,
    },
    {
      file: 'lib/api/topic-data/mv-queries.ts',
      mustReference: /getValidExamPositions|ownOfficialPredicate|buildOfficialExamFilter/,
    },
  ]

  for (const { file, mustReference } of targets) {
    it(`${file} deriva el conteo de oficiales de la fuente única`, () => {
      const src = fs.readFileSync(path.join(process.cwd(), file), 'utf8')
      expect(mustReference.test(src)).toBe(true)
    })

    it(`${file} NO usa un filter(q => q.isOfficialExam) a pelo (sin exam_position)`, () => {
      const src = fs.readFileSync(path.join(process.cwd(), file), 'utf8')
      // Patrón del bug: filtrar/contar por isOfficialExam SIN mirar examPosition
      // en la misma expresión. Permitimos el predicado de la fuente única.
      const rawOfficialFilter =
        /\.filter\(\s*\(?\s*\w+\s*\)?\s*=>\s*[^)]*\bisOfficialExam\b(?![^)]*examPosition)[^)]*\)/
      expect(rawOfficialFilter.test(src)).toBe(false)
    })
  }
})

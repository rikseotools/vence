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
import { ownOfficialPredicate } from '@/lib/api/oposicion-scope/queries'

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

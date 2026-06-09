// Tests de la clasificación "en blanco" vs "fallo real" de la vista de fallos.
// Caso real: Laura (feedback 9f141fa3) dejó preguntas en blanco en un examen y
// el sistema se las contaba como fallos, sin poder distinguir sus errores reales.
// Fix: derivar "en blanco" de user_answer vacío (fuente fiable; was_blank no se
// setea bien en exámenes abandonados). Las blancas SIGUEN en el repaso (motor de
// debilidad), solo se etiquetan aparte.

import { isBlankAnswer, accumulateFailure, EMPTY_BREAKDOWN } from '@/lib/api/user-failed-questions/blank'

describe('isBlankAnswer — fuente de verdad: user_answer vacío', () => {
  it('null / undefined → en blanco', () => {
    expect(isBlankAnswer(null)).toBe(true)
    expect(isBlankAnswer(undefined)).toBe(true)
  })
  it('cadena vacía o solo espacios → en blanco', () => {
    expect(isBlankAnswer('')).toBe(true)
    expect(isBlankAnswer('   ')).toBe(true)
  })
  it('respuesta real (a/b/c/d) → NO en blanco', () => {
    for (const a of ['a', 'b', 'c', 'd']) expect(isBlankAnswer(a)).toBe(false)
  })
})

describe('accumulateFailure — desglose por pregunta', () => {
  it('una blanca → blankCount 1, onlyBlank true', () => {
    const r = accumulateFailure(EMPTY_BREAKDOWN, '')
    expect(r).toEqual({ wrongCount: 0, blankCount: 1, onlyBlank: true })
  })
  it('un fallo real → wrongCount 1, onlyBlank false', () => {
    const r = accumulateFailure(EMPTY_BREAKDOWN, 'b')
    expect(r).toEqual({ wrongCount: 1, blankCount: 0, onlyBlank: false })
  })
  it('blanca y luego fallo real → cuenta ambos, onlyBlank false', () => {
    let r = accumulateFailure(EMPTY_BREAKDOWN, null)
    r = accumulateFailure(r, 'c')
    expect(r).toEqual({ wrongCount: 1, blankCount: 1, onlyBlank: false })
  })
  it('dos blancas → onlyBlank sigue true', () => {
    let r = accumulateFailure(EMPTY_BREAKDOWN, '')
    r = accumulateFailure(r, '   ')
    expect(r).toEqual({ wrongCount: 0, blankCount: 2, onlyBlank: true })
  })
})

describe('SIMULACIÓN — examen real de Laura (49 preguntas: 40 en blanco, 4 falladas, 5 acertadas)', () => {
  // En la vista de fallos solo entran las is_correct=false: 40 blancas + 4 falladas.
  // Replica el agrupado por pregunta de getUserFailedQuestions (cada pregunta 1 aparición).
  it('separa 4 fallos reales de 40 en blanco', () => {
    const occurrences: Array<string | null> = [
      ...Array.from({ length: 40 }, () => '' as string | null), // 40 en blanco
      'b', 'a', 'c', 'd', // 4 contestadas mal (de la BD real de Laura)
    ]
    // Cada aparición es una pregunta distinta aquí (agrupación 1:1).
    const perQuestion = occurrences.map(ua => accumulateFailure(EMPTY_BREAKDOWN, ua))
    const realFailures = perQuestion.filter(q => !q.onlyBlank).length
    const blankOnly = perQuestion.filter(q => q.onlyBlank).length

    expect(realFailures).toBe(4)   // ANTES se mostraban 44 "fallos"; ahora 4 reales
    expect(blankOnly).toBe(40)
    expect(realFailures + blankOnly).toBe(44) // total is_correct=false (no las 5 acertadas)
  })

  it('una pregunta dejada en blanco una vez y fallada otra cuenta como fallo real (no se pierde del repaso)', () => {
    // misma pregunta: primero en blanco, luego contestada mal
    let r = accumulateFailure(EMPTY_BREAKDOWN, '')
    r = accumulateFailure(r, 'a')
    expect(r.onlyBlank).toBe(false) // es fallo real
    expect(r.blankCount).toBe(1)
    expect(r.wrongCount).toBe(1)
  })
})

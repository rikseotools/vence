// __tests__/components/QuestionEvolution.test.ts
//
// Tests de los helpers puros de QuestionEvolution (migrado a .tsx 15/4/2026
// con soporte blanco). Testean la lógica de clasificación, rachas,
// transiciones de evolución y cálculos agregados.
//
// NO montan el componente React (demasiados mocks de supabase) — testean
// los helpers exportados que contienen toda la lógica de negocio.

// Mock de supabase para no disparar el cliente real al importar el módulo
jest.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }) }) }),
  }),
}))

import {
  clasificarIntento,
  calcularRachaMaximaCorrecta,
  calcularRachaMaximaIncorrecta,
  determinarTipoEvolucion,
  calcularEvolucionCompleta,
} from '@/components/QuestionEvolution'

// Helper para construir un HistoryEntry mínimo
let __idCounter = 0
function mkEntry(opts: { correct: boolean; blank?: boolean; at?: string; time?: number; conf?: string | null }): any {
  return {
    id: `id-${++__idCounter}`,
    user_answer: opts.blank ? 'BLANK' : opts.correct ? 'A' : 'B',
    correct_answer: 'A',
    is_correct: opts.correct,
    was_blank: opts.blank ?? false,
    confidence_level: opts.conf ?? null,
    time_spent_seconds: opts.time ?? 5,
    created_at: opts.at ?? '2026-01-01T00:00:00Z',
    test_id: 'test-1',
    question_order: 1,
    tests: null,
  }
}

describe('clasificarIntento — 3 estados (correct / incorrect / blank)', () => {
  test('correct: is_correct=true, was_blank=false → correct', () => {
    expect(clasificarIntento({ is_correct: true, was_blank: false })).toBe('correct')
  })
  test('correct con was_blank undefined (legacy) → correct', () => {
    expect(clasificarIntento({ is_correct: true })).toBe('correct')
  })
  test('incorrect: is_correct=false, was_blank=false → incorrect', () => {
    expect(clasificarIntento({ is_correct: false, was_blank: false })).toBe('incorrect')
  })
  test('blank: was_blank=true → blank (aunque is_correct venga como false)', () => {
    expect(clasificarIntento({ is_correct: false, was_blank: true })).toBe('blank')
  })
  test('blank prevalece: was_blank=true gana aunque is_correct=true (no debería pasar)', () => {
    // Defensa: si la BD tiene una fila inconsistente, priorizamos was_blank
    expect(clasificarIntento({ is_correct: true, was_blank: true })).toBe('blank')
  })
})

describe('calcularRachaMaximaCorrecta — blanco NO rompe racha', () => {
  test('sin historial: racha = 0', () => {
    expect(calcularRachaMaximaCorrecta([])).toBe(0)
  })
  test('3 correctas seguidas: racha = 3', () => {
    const h = [
      mkEntry({ correct: true }),
      mkEntry({ correct: true }),
      mkEntry({ correct: true }),
    ]
    expect(calcularRachaMaximaCorrecta(h)).toBe(3)
  })
  test('correcta, fallo, correcta: racha = 1', () => {
    const h = [
      mkEntry({ correct: true }),
      mkEntry({ correct: false }),
      mkEntry({ correct: true }),
    ]
    expect(calcularRachaMaximaCorrecta(h)).toBe(1)
  })
  test('CRÍTICO: correcta, BLANCO, correcta → racha = 2 (blanco NO rompe)', () => {
    const h = [
      mkEntry({ correct: true }),
      mkEntry({ correct: false, blank: true }),
      mkEntry({ correct: true }),
    ]
    expect(calcularRachaMaximaCorrecta(h)).toBe(2)
  })
  test('múltiples blancos intercalados: racha sigue intacta', () => {
    const h = [
      mkEntry({ correct: true }),
      mkEntry({ correct: false, blank: true }),
      mkEntry({ correct: true }),
      mkEntry({ correct: false, blank: true }),
      mkEntry({ correct: true }),
    ]
    expect(calcularRachaMaximaCorrecta(h)).toBe(3)
  })
  test('solo blancos: racha = 0 (ninguna correcta)', () => {
    const h = [mkEntry({ correct: false, blank: true }), mkEntry({ correct: false, blank: true })]
    expect(calcularRachaMaximaCorrecta(h)).toBe(0)
  })
  test('fallo real sí rompe: ✓ ✓ ✗ ✓ → racha = 2', () => {
    const h = [
      mkEntry({ correct: true }),
      mkEntry({ correct: true }),
      mkEntry({ correct: false }),
      mkEntry({ correct: true }),
    ]
    expect(calcularRachaMaximaCorrecta(h)).toBe(2)
  })
})

describe('calcularRachaMaximaIncorrecta — solo fallos reales (blanco no cuenta)', () => {
  test('3 fallos seguidos: racha = 3', () => {
    const h = Array.from({ length: 3 }, () => mkEntry({ correct: false }))
    expect(calcularRachaMaximaIncorrecta(h)).toBe(3)
  })
  test('fallo, blanco, fallo → racha = 2 (blanco no rompe fallos)', () => {
    const h = [
      mkEntry({ correct: false }),
      mkEntry({ correct: false, blank: true }),
      mkEntry({ correct: false }),
    ]
    expect(calcularRachaMaximaIncorrecta(h)).toBe(2)
  })
  test('solo blancos: racha incorrecta = 0 (blanco NO es fallo real)', () => {
    const h = Array.from({ length: 3 }, () => mkEntry({ correct: false, blank: true }))
    expect(calcularRachaMaximaIncorrecta(h)).toBe(0)
  })
  test('correcta en medio sí rompe: ✗ ✓ ✗ → racha incorrecta = 1', () => {
    const h = [
      mkEntry({ correct: false }),
      mkEntry({ correct: true }),
      mkEntry({ correct: false }),
    ]
    expect(calcularRachaMaximaIncorrecta(h)).toBe(1)
  })
})

describe('determinarTipoEvolucion — modo legacy (sin currentResult)', () => {
  // Modo legacy: cuando el componente se renderiza sin pregunta activa
  // (revisión post-examen, etc.), comparamos penúltimo vs último del historial.
  test('history vacío → "primera_vez"', () => {
    const r = determinarTipoEvolucion([])
    expect(r.tipo).toBe('primera_vez')
  })
  test('1 previo blanco (sin current) → "blanco_reciente"', () => {
    const r = determinarTipoEvolucion([mkEntry({ correct: false, blank: true })])
    expect(r.tipo).toBe('blanco_reciente')
    expect(r.color).toBe('gray')
  })
  test('1 previo acertado (sin current) → "consistente_correcto"', () => {
    const r = determinarTipoEvolucion([mkEntry({ correct: true })])
    expect(r.tipo).toBe('consistente_correcto')
    expect(r.mensaje).toContain('última vez')
  })
  test('1 previo fallado (sin current) → "consistente_incorrecto"', () => {
    const r = determinarTipoEvolucion([mkEntry({ correct: false })])
    expect(r.tipo).toBe('consistente_incorrecto')
    expect(r.mensaje).toContain('última vez')
  })
  test('blanco → acierto → "mejora_desde_blanco"', () => {
    const h = [mkEntry({ correct: false, blank: true }), mkEntry({ correct: true })]
    const r = determinarTipoEvolucion(h)
    expect(r.tipo).toBe('mejora_desde_blanco')
    expect(r.color).toBe('green')
  })
  test('fallo → acierto → "mejora"', () => {
    const h = [mkEntry({ correct: false }), mkEntry({ correct: true })]
    const r = determinarTipoEvolucion(h)
    expect(r.tipo).toBe('mejora')
  })
  test('acierto → blanco → "retroceso_a_blanco"', () => {
    const h = [mkEntry({ correct: true }), mkEntry({ correct: false, blank: true })]
    const r = determinarTipoEvolucion(h)
    expect(r.tipo).toBe('retroceso_a_blanco')
    expect(r.color).toBe('orange')
  })
  test('acierto → fallo → "retroceso"', () => {
    const h = [mkEntry({ correct: true }), mkEntry({ correct: false })]
    const r = determinarTipoEvolucion(h)
    expect(r.tipo).toBe('retroceso')
  })
  test('acierto consistente → "consistente_correcto"', () => {
    const h = [
      mkEntry({ correct: true }),
      mkEntry({ correct: true }),
      mkEntry({ correct: true }),
    ]
    const r = determinarTipoEvolucion(h)
    expect(r.tipo).toBe('consistente_correcto')
  })
  test('blanco consistente → "consistente_blanco"', () => {
    const h = [
      mkEntry({ correct: false, blank: true }),
      mkEntry({ correct: false, blank: true }),
    ]
    const r = determinarTipoEvolucion(h)
    expect(r.tipo).toBe('consistente_blanco')
    expect(r.color).toBe('gray')
  })
  test('fallo consistente → "consistente_incorrecto"', () => {
    const h = [
      mkEntry({ correct: false }),
      mkEntry({ correct: false }),
    ]
    const r = determinarTipoEvolucion(h)
    expect(r.tipo).toBe('consistente_incorrecto')
  })
})

describe('determinarTipoEvolucion — modo contractual (con currentResult)', () => {
  // CONTRATO: history contiene SOLO los intentos PREVIOS al actual.
  // El intento actual viene en currentResult, no está en history.
  // length=0 ⇒ primera vez. length=N ⇒ (N+1).ª vez.
  // (Bug histórico hasta 05/05/2026: length=1 se trataba como "primera vez".)

  test('history vacío + current acierto → "primera_vez" (sin comparación)', () => {
    const r = determinarTipoEvolucion([], { is_correct: true })
    expect(r.tipo).toBe('primera_vez')
  })
  test('1 previo acierto + current acierto → "consistente_correcto" (NO primera_vez)', () => {
    const r = determinarTipoEvolucion([mkEntry({ correct: true })], { is_correct: true })
    expect(r.tipo).toBe('consistente_correcto')
    expect(r.mensaje).toContain('2/2')
  })
  test('1 previo fallo + current acierto → "mejora"', () => {
    const r = determinarTipoEvolucion([mkEntry({ correct: false })], { is_correct: true })
    expect(r.tipo).toBe('mejora')
  })
  test('1 previo acierto + current fallo → "retroceso"', () => {
    const r = determinarTipoEvolucion([mkEntry({ correct: true })], { is_correct: false })
    expect(r.tipo).toBe('retroceso')
  })
  test('1 previo blanco + current acierto → "mejora_desde_blanco"', () => {
    const r = determinarTipoEvolucion(
      [mkEntry({ correct: false, blank: true })],
      { is_correct: true },
    )
    expect(r.tipo).toBe('mejora_desde_blanco')
  })
  test('1 previo acierto + current blanco → "retroceso_a_blanco"', () => {
    const r = determinarTipoEvolucion(
      [mkEntry({ correct: true })],
      { is_correct: false, was_blank: true },
    )
    expect(r.tipo).toBe('retroceso_a_blanco')
  })
  test('3+ previos consistentes correctos + current acierto → "consistente_correcto" (4/4)', () => {
    const h = [
      mkEntry({ correct: true }),
      mkEntry({ correct: true }),
      mkEntry({ correct: true }),
    ]
    const r = determinarTipoEvolucion(h, { is_correct: true })
    expect(r.tipo).toBe('consistente_correcto')
    expect(r.mensaje).toContain('4/4')
  })
  test('current ignora penúltimo: previo [fallo, acierto] + current fallo → retroceso (último previo=acierto)', () => {
    // Confirma que la lógica usa el último previo (no el penúltimo) para comparar con current
    const h = [mkEntry({ correct: false }), mkEntry({ correct: true })]
    const r = determinarTipoEvolucion(h, { is_correct: false })
    expect(r.tipo).toBe('retroceso')
  })
})

describe('calcularEvolucionCompleta — desglose correct/incorrect/blank', () => {
  test('historial vacío', () => {
    const e = calcularEvolucionCompleta([])
    expect(e.totalIntentos).toBe(0)
    expect(e.aciertosAbsolutos).toBe(0)
    expect(e.fallosAbsolutos).toBe(0)
    expect(e.blancosAbsolutos).toBe(0)
    expect(e.tasaAciertos).toBe(0)
  })

  test('2 correctos, 1 fallo, 1 blanco → tasa 50% (2/4)', () => {
    const h = [
      mkEntry({ correct: true }),
      mkEntry({ correct: false }),
      mkEntry({ correct: true }),
      mkEntry({ correct: false, blank: true }),
    ]
    const e = calcularEvolucionCompleta(h)
    expect(e.totalIntentos).toBe(4)
    expect(e.aciertosAbsolutos).toBe(2)
    expect(e.fallosAbsolutos).toBe(1)
    expect(e.blancosAbsolutos).toBe(1)
    expect(e.tasaAciertos).toBe(50)
  })

  test('invariante: aciertos + fallos + blancos === total', () => {
    const h = [
      mkEntry({ correct: true }),
      mkEntry({ correct: false }),
      mkEntry({ correct: true }),
      mkEntry({ correct: false, blank: true }),
      mkEntry({ correct: false, blank: true }),
    ]
    const e = calcularEvolucionCompleta(h)
    expect(e.aciertosAbsolutos + e.fallosAbsolutos + e.blancosAbsolutos).toBe(e.totalIntentos)
  })

  test('estadísticas avanzadas: racha correcta ignora blancas', () => {
    const h = [
      mkEntry({ correct: true }),
      mkEntry({ correct: false, blank: true }),
      mkEntry({ correct: true }),
      mkEntry({ correct: true }),
    ]
    const e = calcularEvolucionCompleta(h)
    expect(e.estadisticasAvanzadas?.rachaMaximaCorrecta).toBe(3)
  })

  test('todas las preguntas en blanco → tasa 0%, racha correcta 0', () => {
    const h = Array.from({ length: 5 }, () => mkEntry({ correct: false, blank: true }))
    const e = calcularEvolucionCompleta(h)
    expect(e.aciertosAbsolutos).toBe(0)
    expect(e.fallosAbsolutos).toBe(0)
    expect(e.blancosAbsolutos).toBe(5)
    expect(e.tasaAciertos).toBe(0)
    expect(e.estadisticasAvanzadas?.rachaMaximaCorrecta).toBe(0)
    expect(e.estadisticasAvanzadas?.rachaMaximaIncorrecta).toBe(0)
  })

  test('CONTRATO + REGRESIÓN: 1 previo + current → no es primera_vez', () => {
    // Bug histórico (hasta 05/05/2026): cuando había 1 intento previo, el componente
    // mostraba "Primera vez que ves esta pregunta" — síntoma reportado por Nila en
    // feedback c294a029 (psicotécnicos) y feedbacks recurrentes en tests normales.
    // Este test documenta el contrato y bloquea la regresión.
    const h = [mkEntry({ correct: true })]
    const eWithCurrent = calcularEvolucionCompleta(h, null, { is_correct: true })
    expect(eWithCurrent.tipoEvolucion).not.toBe('primera_vez')
    expect(eWithCurrent.tipoEvolucion).toBe('consistente_correcto')

    // Modo legacy (sin currentResult): tampoco debe ser primera_vez si hay 1 previo
    const eLegacy = calcularEvolucionCompleta(h)
    expect(eLegacy.tipoEvolucion).not.toBe('primera_vez')
  })

  test('regresión: data legacy sin was_blank (antes del 15/4/2026) se trata como is_correct normal', () => {
    // Entries antiguos no tienen was_blank field
    const legacyEntry: any = {
      id: 'x',
      user_answer: 'A',
      correct_answer: 'A',
      is_correct: true,
      // was_blank NO presente
      confidence_level: null,
      time_spent_seconds: 5,
      created_at: '2025-01-01T00:00:00Z',
      test_id: 't',
      question_order: 1,
      tests: null,
    }
    const e = calcularEvolucionCompleta([legacyEntry])
    expect(e.totalIntentos).toBe(1)
    expect(e.aciertosAbsolutos).toBe(1)
    expect(e.blancosAbsolutos).toBe(0)
  })
})

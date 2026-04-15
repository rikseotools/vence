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

describe('determinarTipoEvolucion — mensajes por transición', () => {
  test('primera vez con blanco → "blanco_reciente"', () => {
    const r = determinarTipoEvolucion([mkEntry({ correct: false, blank: true })])
    expect(r.tipo).toBe('blanco_reciente')
    expect(r.color).toBe('gray')
    expect(r.icono).toBe('⚪')
  })
  test('primera vez acertando → "primera_vez"', () => {
    const r = determinarTipoEvolucion([mkEntry({ correct: true })])
    expect(r.tipo).toBe('primera_vez')
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

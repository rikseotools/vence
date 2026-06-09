// Tests de los helpers puros del selector de nº de preguntas del TestConfigurator
// (presets 10/25/50/100 + cantidad PERSONALIZADA, ej. 70 para simular el examen
// real). Caso real: feedback de Laura (CARM, examen 21/06) que pedía un test de
// 70 preguntas del tirón y solo había presets fijos.
//
// NO montamos el componente (demasiados mocks de auth/hooks) — testeamos los
// helpers exportados con la lógica de negocio. Mismo patrón que DailyGoalBanner.

// Mock de supabase para no disparar el cliente real al importar la cadena de
// módulos (TestConfigurator → contexts/hooks → supabase).
jest.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }) }),
  }),
}))

import {
  QUESTION_COUNT_PRESETS,
  customQuestionCap,
  isCustomQuestionCount,
  clampCustomQuestionCount,
} from '@/components/TestConfigurator'

describe('QUESTION_COUNT_PRESETS', () => {
  it('son exactamente 10, 25, 50, 100', () => {
    expect([...QUESTION_COUNT_PRESETS]).toEqual([10, 25, 50, 100])
  })
})

describe('customQuestionCap — tope en cliente (hard cap 100, o menos si hay pocas)', () => {
  it('muchas disponibles → 100 (hard cap, no satura Supabase)', () => {
    expect(customQuestionCap(500)).toBe(100)
    expect(customQuestionCap(101)).toBe(100)
  })
  it('exactamente 100 → 100', () => {
    expect(customQuestionCap(100)).toBe(100)
  })
  it('menos de 100 disponibles → ese número', () => {
    expect(customQuestionCap(60)).toBe(60)
    expect(customQuestionCap(1)).toBe(1)
  })
  it('floor de decimales', () => {
    expect(customQuestionCap(70.9)).toBe(70)
  })
  it('0 / negativo / NaN → fallback 100 (los useEffect de clamp ajustan luego)', () => {
    expect(customQuestionCap(0)).toBe(100)
    expect(customQuestionCap(-5)).toBe(100)
    expect(customQuestionCap(NaN)).toBe(100)
    expect(customQuestionCap(Infinity)).toBe(100)
  })
})

describe('isCustomQuestionCount — ¿el valor NO es un preset?', () => {
  it('presets → false (el input personalizado se vacía)', () => {
    for (const p of QUESTION_COUNT_PRESETS) expect(isCustomQuestionCount(p)).toBe(false)
  })
  it('valores no-preset → true (input activo/resaltado)', () => {
    expect(isCustomQuestionCount(70)).toBe(true)
    expect(isCustomQuestionCount(1)).toBe(true)
    expect(isCustomQuestionCount(45)).toBe(true)
    expect(isCustomQuestionCount(99)).toBe(true)
  })
})

describe('clampCustomQuestionCount — sanea lo tecleado a [1, cap]', () => {
  it('caso Laura: teclea 70 con muchas disponibles → 70', () => {
    expect(clampCustomQuestionCount(70, 500)).toBe(70)
  })
  it('teclea más que las disponibles → se limita a las disponibles', () => {
    expect(clampCustomQuestionCount(70, 60)).toBe(60)
  })
  it('teclea más que el hard cap → 100', () => {
    expect(clampCustomQuestionCount(999, 500)).toBe(100)
  })
  it('0 o negativo → mínimo 1', () => {
    expect(clampCustomQuestionCount(0, 500)).toBe(1)
    expect(clampCustomQuestionCount(-3, 500)).toBe(1)
  })
  it('decimal → floor', () => {
    expect(clampCustomQuestionCount(70.9, 500)).toBe(70)
  })
  it('NaN (input vacío, parseInt("")) → null (el caller ignora, no rompe estado)', () => {
    expect(clampCustomQuestionCount(NaN, 500)).toBeNull()
    expect(clampCustomQuestionCount(parseInt('', 10), 500)).toBeNull()
  })
  it('Infinity → null', () => {
    expect(clampCustomQuestionCount(Infinity, 500)).toBeNull()
  })
})

// ============================================================
// Simulación de INTEGRACIÓN: reproduce el flujo real del componente
// (input → clampCustomQuestionCount → setSelectedQuestions → memo
// maxQuestions) para confirmar el tamaño FINAL del test en cada escenario.
// `maxQuestions` replica la lógica del componente (líneas ~522-534):
// el test se construye con min(selección, disponibles, [límite diario]).
// ============================================================
function simulateFinalTestSize(opts: {
  typed: string
  available: number
  premium: boolean
  remaining: number
  prevSelected?: number
}): number {
  const { typed, available, premium, remaining, prevSelected = 25 } = opts
  // onChange del input personalizado:
  const next = clampCustomQuestionCount(parseInt(typed, 10), available)
  const selected = next ?? prevSelected // null → no cambia el estado
  // memo maxQuestions del componente:
  const candidates = [selected, available]
  if (!premium && remaining >= 0) candidates.push(remaining)
  return Math.max(0, Math.min(...candidates))
}

describe('Simulación de integración — tamaño final del test', () => {
  it('Laura (premium, 120 disp) teclea 70 → test de 70', () => {
    expect(simulateFinalTestSize({ typed: '70', available: 120, premium: true, remaining: 0 })).toBe(70)
  })
  it('free con 25/día restantes teclea 70 → limitado a 25 (mismo clamp que los presets)', () => {
    expect(simulateFinalTestSize({ typed: '70', available: 120, premium: false, remaining: 25 })).toBe(25)
  })
  it('solo 60 disponibles, teclea 70 → 60', () => {
    expect(simulateFinalTestSize({ typed: '70', available: 60, premium: true, remaining: 0 })).toBe(60)
  })
  it('abuso: teclea 999 → 100 (hard cap)', () => {
    expect(simulateFinalTestSize({ typed: '999', available: 500, premium: true, remaining: 0 })).toBe(100)
  })
  it('borra el input (vacío) → mantiene la selección previa, no rompe', () => {
    expect(simulateFinalTestSize({ typed: '', available: 120, premium: true, remaining: 0, prevSelected: 50 })).toBe(50)
  })
})

// __tests__/api/filtered-questions/positionTypeTolerant.test.ts
//
// Guardarraíl del INCIDENTE Alfonso (11/07/2026): un usuario premium con oposición
// 'bibliotecario' (oposición AÚN NO construida, sin entrada en POSITION_TYPES_ENUM)
// no podía crear NINGÚN test multi-ley: la página manda `positionType: target_oposicion`
// y el schema Zod `z.enum(POSITION_TYPES_ENUM)` devolvía 400 "Parámetros inválidos"
// con cualquier nº de preguntas. Alcance real medido: 726 usuarios con target_oposicion
// fuera del enum.
//
// Fix: `positionType` es TOLERANTE (z.string().min(1).max(200)). Un positionType
// desconocido no tiene temario, así que degrada con gracia en queries.ts (sirve la
// selección explícita del usuario) SIN fuga de scope ajeno — buildOfficialExamFilter
// y buildQuestionTagFilter ya excluyen oficiales y tags exclusivos para oposiciones
// no registradas.
//
// Si alguien reintroduce `z.enum(POSITION_TYPES_ENUM)`, estos tests FALLAN.
import {
  safeParseGetFilteredQuestions,
  safeParseCountFilteredQuestions,
} from '@/lib/api/filtered-questions/schemas'

describe('positionType tolerante (guardarraíl incidente Alfonso)', () => {
  const base = {
    topicNumber: 0,
    selectedLaws: ['Ley 39/2015'],
    selectedArticlesByLaw: { 'Ley 39/2015': [1, 2, 3, 4, 5] },
    numQuestions: 100,
    scopeToPosition: true,
  }

  test('oposición sin construir (bibliotecario) valida — con n=100 y n=50', () => {
    expect(safeParseGetFilteredQuestions({ ...base, positionType: 'bibliotecario' }).success).toBe(true)
    expect(safeParseGetFilteredQuestions({ ...base, positionType: 'bibliotecario', numQuestions: 50 }).success).toBe(true)
  })

  test('valores legacy/corruptos (UUID) NO dan 400 — degradan, no rompen', () => {
    const r = safeParseGetFilteredQuestions({ ...base, positionType: 'a5e0c8b6-bb29-425f-bff6-0df725ead72f' })
    expect(r.success).toBe(true)
  })

  test('oposición conocida sigue validando (regresión)', () => {
    expect(safeParseGetFilteredQuestions({ ...base, positionType: 'auxiliar_administrativo_estado' }).success).toBe(true)
  })

  test('positionType vacío se rechaza (la página siempre manda un fallback no vacío)', () => {
    expect(safeParseGetFilteredQuestions({ ...base, positionType: '' }).success).toBe(false)
  })

  test('positionType absurdamente largo (>200c) se rechaza (bound anti-abuso)', () => {
    expect(safeParseGetFilteredQuestions({ ...base, positionType: 'x'.repeat(201) }).success).toBe(false)
  })

  test('el contador (GET count) también es tolerante', () => {
    const c = {
      topicNumber: 1,
      selectedLaws: ['Ley 39/2015'],
      selectedArticlesByLaw: { 'Ley 39/2015': [1, 2] },
    }
    expect(safeParseCountFilteredQuestions({ ...c, positionType: 'bibliotecario' }).success).toBe(true)
    expect(safeParseCountFilteredQuestions({ ...c, positionType: '' }).success).toBe(false)
  })
})

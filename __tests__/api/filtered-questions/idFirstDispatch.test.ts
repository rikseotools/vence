// __tests__/api/filtered-questions/idFirstDispatch.test.ts
// Capa 1: building blocks del dispatcher.
//
// Tests unitarios sobre las dos funciones puras que componen el dispatcher:
// - detectFilteredPath(params): clasifica el request en path 1-6
// - shouldUseIdFirst(): lee feature flag USE_FILTERED_ID_FIRST
//
// El dispatcher hace flag && path === 'p5_6' → idFirst, else → legacy.
// Si las dos funciones unitarias son correctas, el dispatcher es correcto
// por composición.

import { detectFilteredPath, shouldUseIdFirst } from '@/lib/api/filtered-questions/queries'
import type { GetFilteredQuestionsRequest } from '@/lib/api/filtered-questions/schemas'

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'

const baseParams: GetFilteredQuestionsRequest = {
  topicNumber: 1,
  positionType: 'auxiliar_administrativo_estado',
  multipleTopics: [],
  numQuestions: 25,
  selectedLaws: [],
  selectedArticlesByLaw: {},
  selectedSectionFilters: [],
  onlyOfficialQuestions: false,
  includeSharedOfficials: false,
  difficultyMode: 'random',
  excludeRecentDays: 0,
  focusEssentialArticles: false,
  prioritizeNeverSeen: false,
  proportionalByTopic: false,
  onlyFailedQuestions: false,
  failedQuestionIds: [],
  primaryArticleIds: [],
}

describe('detectFilteredPath — clasificación de paths', () => {
  it('path 1: primaryArticleIds presente → p1_content_scope', () => {
    expect(detectFilteredPath({
      ...baseParams,
      primaryArticleIds: ['11111111-1111-1111-1111-111111111111'],
    })).toBe('p1_content_scope')
  })

  it('path 1 prioriza sobre cualquier otra config', () => {
    expect(detectFilteredPath({
      ...baseParams,
      primaryArticleIds: ['11111111-1111-1111-1111-111111111111'],
      selectedLaws: ['CE'],
      onlyFailedQuestions: true,
      userId: VALID_UUID,
    })).toBe('p1_content_scope')
  })

  it('path 2: onlyFailedQuestions + userId + sin IDs → p2_failed_with_scopes', () => {
    expect(detectFilteredPath({
      ...baseParams,
      onlyFailedQuestions: true,
      userId: VALID_UUID,
    })).toBe('p2_failed_with_scopes')
  })

  it('path 2 con failedQuestionIds vacío explícitamente → p2_failed_with_scopes', () => {
    expect(detectFilteredPath({
      ...baseParams,
      onlyFailedQuestions: true,
      failedQuestionIds: [],
      userId: VALID_UUID,
    })).toBe('p2_failed_with_scopes')
  })

  it('path 3: onlyFailedQuestions + failedQuestionIds → p3_failed_with_ids', () => {
    expect(detectFilteredPath({
      ...baseParams,
      onlyFailedQuestions: true,
      failedQuestionIds: ['11111111-1111-1111-1111-111111111111'],
    })).toBe('p3_failed_with_ids')
  })

  it('path 3 prioriza sobre path 2 cuando hay IDs (incluso con userId)', () => {
    expect(detectFilteredPath({
      ...baseParams,
      onlyFailedQuestions: true,
      failedQuestionIds: ['11111111-1111-1111-1111-111111111111'],
      userId: VALID_UUID,
    })).toBe('p3_failed_with_ids')
  })

  it('path 4: sin tema, sin ley, sin onlyFailed → p4_global', () => {
    expect(detectFilteredPath({
      ...baseParams,
      topicNumber: 0,
      multipleTopics: [],
      selectedLaws: [],
    })).toBe('p4_global')
  })

  it('path 5: sin tema, con selectedLaws → p5_6_topic_or_law (modo ley-only)', () => {
    expect(detectFilteredPath({
      ...baseParams,
      topicNumber: 0,
      multipleTopics: [],
      selectedLaws: ['CE'],
    })).toBe('p5_6_topic_or_law')
  })

  it('path 6: con topicNumber > 0 → p5_6_topic_or_law (modo tema)', () => {
    expect(detectFilteredPath({
      ...baseParams,
      topicNumber: 3,
      multipleTopics: [],
      selectedLaws: [],
    })).toBe('p5_6_topic_or_law')
  })

  it('path 6: con multipleTopics → p5_6_topic_or_law (modo multi-tema)', () => {
    expect(detectFilteredPath({
      ...baseParams,
      topicNumber: 0,
      multipleTopics: [1, 2, 3],
      selectedLaws: [],
    })).toBe('p5_6_topic_or_law')
  })

  it('FALLBACK CASE: onlyFailedQuestions sin userId sin IDs → NO path 2/3, fallback p5_6', () => {
    // Reproduce el comportamiento legacy: si onlyFailedQuestions=true pero
    // no hay forma de saber qué falló (no userId, no IDs), el legacy loguea
    // warning y FALLS THROUGH al path 5-6. detectFilteredPath debe identificar
    // este caso como p5_6 (no p2 porque le falta userId).
    expect(detectFilteredPath({
      ...baseParams,
      topicNumber: 1,
      onlyFailedQuestions: true,
      // userId undefined
      failedQuestionIds: [],
    })).toBe('p5_6_topic_or_law')
  })

  it('multipleTopics + selectedLaws → p5_6 (no global porque hay temas)', () => {
    expect(detectFilteredPath({
      ...baseParams,
      topicNumber: 0,
      multipleTopics: [1, 2],
      selectedLaws: ['CE', 'Ley 39/2015'],
    })).toBe('p5_6_topic_or_law')
  })

  it('topicNumber=0 + selectedLaws=[] → p4_global (lo que estudia el modo aleatorio sin tema)', () => {
    expect(detectFilteredPath({
      ...baseParams,
      topicNumber: 0,
      selectedLaws: [],
    })).toBe('p4_global')
  })
})

describe('shouldUseIdFirst — feature flag', () => {
  const originalFlag = process.env.USE_FILTERED_ID_FIRST

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.USE_FILTERED_ID_FIRST
    } else {
      process.env.USE_FILTERED_ID_FIRST = originalFlag
    }
  })

  it('default (sin env var) → false', () => {
    delete process.env.USE_FILTERED_ID_FIRST
    expect(shouldUseIdFirst()).toBe(false)
  })

  it('"true" → true', () => {
    process.env.USE_FILTERED_ID_FIRST = 'true'
    expect(shouldUseIdFirst()).toBe(true)
  })

  it('"false" → false', () => {
    process.env.USE_FILTERED_ID_FIRST = 'false'
    expect(shouldUseIdFirst()).toBe(false)
  })

  it('estricto: "1" no es true', () => {
    process.env.USE_FILTERED_ID_FIRST = '1'
    expect(shouldUseIdFirst()).toBe(false)
  })

  it('estricto: "TRUE" mayúsculas no es true', () => {
    process.env.USE_FILTERED_ID_FIRST = 'TRUE'
    expect(shouldUseIdFirst()).toBe(false)
  })

  it('estricto: "yes" no es true', () => {
    process.env.USE_FILTERED_ID_FIRST = 'yes'
    expect(shouldUseIdFirst()).toBe(false)
  })

  it('estricto: string vacío no es true', () => {
    process.env.USE_FILTERED_ID_FIRST = ''
    expect(shouldUseIdFirst()).toBe(false)
  })
})

describe('Composición dispatcher: cuándo entra idFirst', () => {
  // El dispatcher es: (shouldUseIdFirst() && detectFilteredPath(params) === 'p5_6_topic_or_law') ? idFirst : legacy
  // Verificamos las 4 combinaciones de la tabla de verdad sobre datos reales.

  const originalFlag = process.env.USE_FILTERED_ID_FIRST
  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.USE_FILTERED_ID_FIRST
    } else {
      process.env.USE_FILTERED_ID_FIRST = originalFlag
    }
  })

  it('flag OFF + path 5-6 → legacy (idFirst NO entra)', () => {
    delete process.env.USE_FILTERED_ID_FIRST
    const params = { ...baseParams, topicNumber: 1 }
    const useIdFirst = shouldUseIdFirst() && detectFilteredPath(params) === 'p5_6_topic_or_law'
    expect(useIdFirst).toBe(false)
  })

  it('flag ON + path 5-6 → idFirst', () => {
    process.env.USE_FILTERED_ID_FIRST = 'true'
    const params = { ...baseParams, topicNumber: 1 }
    const useIdFirst = shouldUseIdFirst() && detectFilteredPath(params) === 'p5_6_topic_or_law'
    expect(useIdFirst).toBe(true)
  })

  it('flag ON + path 1 (content_scope) → legacy (paths 1-4 nunca van a idFirst)', () => {
    process.env.USE_FILTERED_ID_FIRST = 'true'
    const params = { ...baseParams, primaryArticleIds: ['11111111-1111-1111-1111-111111111111'] }
    const useIdFirst = shouldUseIdFirst() && detectFilteredPath(params) === 'p5_6_topic_or_law'
    expect(useIdFirst).toBe(false)
  })

  it('flag ON + path 2 (failed-questions con userId) → legacy', () => {
    process.env.USE_FILTERED_ID_FIRST = 'true'
    const params = { ...baseParams, onlyFailedQuestions: true, userId: VALID_UUID }
    const useIdFirst = shouldUseIdFirst() && detectFilteredPath(params) === 'p5_6_topic_or_law'
    expect(useIdFirst).toBe(false)
  })

  it('flag ON + path 3 (failed-questions con IDs) → legacy', () => {
    process.env.USE_FILTERED_ID_FIRST = 'true'
    const params = {
      ...baseParams,
      onlyFailedQuestions: true,
      failedQuestionIds: ['11111111-1111-1111-1111-111111111111'],
    }
    const useIdFirst = shouldUseIdFirst() && detectFilteredPath(params) === 'p5_6_topic_or_law'
    expect(useIdFirst).toBe(false)
  })

  it('flag ON + path 4 (global) → legacy', () => {
    process.env.USE_FILTERED_ID_FIRST = 'true'
    const params = { ...baseParams, topicNumber: 0, selectedLaws: [] }
    const useIdFirst = shouldUseIdFirst() && detectFilteredPath(params) === 'p5_6_topic_or_law'
    expect(useIdFirst).toBe(false)
  })

  it('flag ON + path 5 (ley-only) → idFirst', () => {
    process.env.USE_FILTERED_ID_FIRST = 'true'
    const params = { ...baseParams, topicNumber: 0, selectedLaws: ['CE'] }
    const useIdFirst = shouldUseIdFirst() && detectFilteredPath(params) === 'p5_6_topic_or_law'
    expect(useIdFirst).toBe(true)
  })

  it('flag OFF + path 1-4 → legacy (negativo doble)', () => {
    delete process.env.USE_FILTERED_ID_FIRST
    const params = { ...baseParams, topicNumber: 0, selectedLaws: [] } // path 4
    const useIdFirst = shouldUseIdFirst() && detectFilteredPath(params) === 'p5_6_topic_or_law'
    expect(useIdFirst).toBe(false)
  })
})

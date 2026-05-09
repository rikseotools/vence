/**
 * @jest-environment node
 */
// __tests__/integration/idFirstRealDbParity.test.ts
// Capa 4: paridad legacy vs idFirst contra BD REAL (Supabase).
//
// IMPORTANTE: Usa testEnvironment node (no jsdom) porque postgres-js requiere
// TCP nativo de Node. En jsdom (default global) las conexiones TCP cuelgan.
//
// Cubre escenarios documentados de producción para validar que el refactor
// ID-first NO introduce divergencia con datos reales.
//
// Saltado automáticamente sin DATABASE_URL (CI-safe).
//
// Cómo correrlo localmente:
//   DATABASE_URL="postgresql://..." npx jest __tests__/integration/idFirstRealDbParity
//
// Estrategia:
//   1. Math.random seeded con valor fijo para determinismo
//   2. Run legacy(params) → questions A
//   3. Run idFirst(params) → questions B
//   4. Assert: mismo set de IDs (orden puede variar si Postgres no garantiza ORDER BY)
//   5. Assert: cardinalidad, totalAvailable, filtersApplied iguales

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local', override: true })

import { getFilteredQuestionsLegacy, getFilteredQuestionsIdFirst } from '@/lib/api/filtered-questions'
import type { GetFilteredQuestionsRequest } from '@/lib/api/filtered-questions'

const hasRealDb = !!(process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('test.supabase.co'))
const describeIfDb = hasRealDb ? describe : describe.skip

const baseParams: GetFilteredQuestionsRequest = {
  topicNumber: 0,
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

/** Seed Math.random para que los shuffles sean deterministas. */
function seedMath(value: number) {
  const original = Math.random
  Math.random = () => value
  return () => { Math.random = original }
}

/**
 * Ejecuta legacy y idFirst con los mismos params + mismo seed,
 * compara los resultados y devuelve diagnóstico para asserts.
 */
async function runParity(params: GetFilteredQuestionsRequest, seed = 0.5) {
  const restoreA = seedMath(seed)
  const legacyResult = await getFilteredQuestionsLegacy(params)
  restoreA()

  const restoreB = seedMath(seed)
  const idFirstResult = await getFilteredQuestionsIdFirst(params)
  restoreB()

  const legacyIds = (legacyResult.questions || []).map(q => q.id).sort()
  const idFirstIds = (idFirstResult.questions || []).map(q => q.id).sort()

  return {
    legacy: legacyResult,
    idFirst: idFirstResult,
    legacyIds,
    idFirstIds,
    sameIds: JSON.stringify(legacyIds) === JSON.stringify(idFirstIds),
  }
}

describeIfDb('Capa 4: paridad legacy vs idFirst con BD real', () => {
  jest.setTimeout(60_000) // queries reales pueden tardar varios segundos

  describe('Path 5: modo ley-only', () => {
    it('CE single law, 25 preguntas: misma selección', async () => {
      const params: GetFilteredQuestionsRequest = {
        ...baseParams,
        selectedLaws: ['CE'],
        numQuestions: 25,
      }
      const { legacy, idFirst, legacyIds, idFirstIds, sameIds } = await runParity(params)

      expect(legacy.success).toBe(true)
      expect(idFirst.success).toBe(true)
      expect(legacy.questions?.length).toBe(idFirst.questions?.length)
      expect(legacy.questions?.length).toBeGreaterThan(0)
      expect(legacy.totalAvailable).toBe(idFirst.totalAvailable)
      expect(legacy.filtersApplied).toEqual(idFirst.filtersApplied)
      expect(idFirstIds).toEqual(legacyIds)
      expect(sameIds).toBe(true)
    })

    it('Ley 39/2015 single law, 25 preguntas: misma selección', async () => {
      const params: GetFilteredQuestionsRequest = {
        ...baseParams,
        selectedLaws: ['Ley 39/2015'],
        numQuestions: 25,
      }
      const { legacy, idFirst, legacyIds, idFirstIds } = await runParity(params)

      expect(legacy.success).toBe(true)
      expect(idFirst.success).toBe(true)
      expect(legacy.questions?.length).toBe(idFirst.questions?.length)
      expect(idFirstIds).toEqual(legacyIds)
    })

    it('Multi-ley CE + Ley 39: distribución equitativa por ley idéntica', async () => {
      const params: GetFilteredQuestionsRequest = {
        ...baseParams,
        selectedLaws: ['CE', 'Ley 39/2015'],
        numQuestions: 30,
      }
      const { legacy, idFirst, legacyIds, idFirstIds } = await runParity(params, 0.42)

      expect(legacy.questions?.length).toBe(idFirst.questions?.length)
      expect(idFirstIds).toEqual(legacyIds)

      // Distribución equitativa por ley debe coincidir
      const lawCount = (qs: Array<{ article: { law_short_name: string } }>) => {
        const c: Record<string, number> = {}
        for (const q of qs) c[q.article.law_short_name] = (c[q.article.law_short_name] || 0) + 1
        return c
      }
      expect(lawCount(idFirst.questions || [])).toEqual(lawCount(legacy.questions || []))
    })

    it('Ley 40/2015 con selectedArticlesByLaw subset: respeta filtro de artículos', async () => {
      const params: GetFilteredQuestionsRequest = {
        ...baseParams,
        selectedLaws: ['Ley 40/2015'],
        selectedArticlesByLaw: { 'Ley 40/2015': [1, 2, 3, 4, 5] },
        numQuestions: 10,
      }
      const { legacy, idFirst, legacyIds, idFirstIds } = await runParity(params)

      expect(legacy.questions?.length).toBe(idFirst.questions?.length)
      expect(idFirstIds).toEqual(legacyIds)

      // Verificar que TODOS los devueltos están en artículos 1-5
      const idFirstArts = new Set((idFirst.questions || []).map(q => q.article.number))
      const legacyArts = new Set((legacy.questions || []).map(q => q.article.number))
      expect(idFirstArts).toEqual(legacyArts)
      for (const art of idFirstArts) {
        expect([1, 2, 3, 4, 5].map(String)).toContain(art)
      }
    })
  })

  describe('Path 6: modo tema', () => {
    it('Auxiliar T1 (single law en scope): misma selección', async () => {
      const params: GetFilteredQuestionsRequest = {
        ...baseParams,
        topicNumber: 1,
        positionType: 'auxiliar_administrativo_estado',
        numQuestions: 20,
      }
      const { legacy, idFirst, legacyIds, idFirstIds } = await runParity(params)

      expect(legacy.success).toBe(true)
      expect(idFirst.success).toBe(true)
      expect(legacy.questions?.length).toBe(idFirst.questions?.length)
      expect(legacy.questions?.length).toBeGreaterThan(0)
      expect(idFirstIds).toEqual(legacyIds)
    })

    it('Auxiliar T3 (multi-law en scope): misma selección', async () => {
      const params: GetFilteredQuestionsRequest = {
        ...baseParams,
        topicNumber: 3,
        positionType: 'auxiliar_administrativo_estado',
        numQuestions: 25,
      }
      const { legacy, idFirst, legacyIds, idFirstIds } = await runParity(params)

      expect(legacy.questions?.length).toBe(idFirst.questions?.length)
      expect(idFirstIds).toEqual(legacyIds)
    })

    it('Multi-tema [1,2,3] auxiliar con proporcional: distribución por tema idéntica', async () => {
      const params: GetFilteredQuestionsRequest = {
        ...baseParams,
        topicNumber: 0,
        multipleTopics: [1, 2, 3],
        positionType: 'auxiliar_administrativo_estado',
        proportionalByTopic: true,
        numQuestions: 30,
      }
      const { legacy, idFirst, legacyIds, idFirstIds } = await runParity(params, 0.7)

      expect(legacy.questions?.length).toBe(idFirst.questions?.length)
      expect(idFirstIds).toEqual(legacyIds)

      const temaCount = (qs: Array<{ tema: number | null }>) => {
        const c: Record<string, number> = {}
        for (const q of qs) c[String(q.tema)] = (c[String(q.tema)] || 0) + 1
        return c
      }
      expect(temaCount(idFirst.questions || [])).toEqual(temaCount(legacy.questions || []))
    })

    it('Tema con selectedLaws filtro post-scope: respeta filtro de leyes', async () => {
      const params: GetFilteredQuestionsRequest = {
        ...baseParams,
        topicNumber: 3,
        positionType: 'auxiliar_administrativo_estado',
        selectedLaws: ['CE'],
        numQuestions: 10,
      }
      const { legacy, idFirst, legacyIds, idFirstIds } = await runParity(params)

      expect(legacy.questions?.length).toBe(idFirst.questions?.length)
      expect(idFirstIds).toEqual(legacyIds)

      // Verificar que SOLO devuelve preguntas de CE (filtro aplicado)
      for (const q of idFirst.questions || []) {
        expect(q.article.law_short_name).toBe('CE')
      }
    })
  })

  describe('Edge cases reales', () => {
    it('PN questionTag: solo preguntas con tag PN (oposición exclusiva)', async () => {
      const params: GetFilteredQuestionsRequest = {
        ...baseParams,
        topicNumber: 1,
        positionType: 'policia_nacional',
        numQuestions: 15,
      }
      const { legacy, idFirst, legacyIds, idFirstIds } = await runParity(params)

      expect(legacy.questions?.length).toBe(idFirst.questions?.length)
      expect(idFirstIds).toEqual(legacyIds)

      // Las preguntas devueltas DEBEN tener tag PN (verificar en metadata)
      for (const q of idFirst.questions || []) {
        expect(q.metadata.tags).toContain('PN')
      }
    })

    it('Oposición sin scopes (celador_sermas_madrid): ambas devuelven empty con mismo emptyReason', async () => {
      const params: GetFilteredQuestionsRequest = {
        ...baseParams,
        topicNumber: 1,
        positionType: 'celador_sermas_madrid' as never, // no está en enum, pero en BD existe — testar el comportamiento
        numQuestions: 10,
      }
      const { legacy, idFirst } = await runParity(params)

      // Ambas devuelven success=true con questions vacías (path 6 sin scopes)
      expect(legacy.success).toBe(idFirst.success)
      expect(legacy.questions?.length).toBe(idFirst.questions?.length)
      expect(idFirst.emptyReason).toBe(legacy.emptyReason)
    })

    it('difficultyMode "easy" con NULL coalesce: misma selección', async () => {
      const params: GetFilteredQuestionsRequest = {
        ...baseParams,
        topicNumber: 1,
        positionType: 'auxiliar_administrativo_estado',
        difficultyMode: 'easy',
        numQuestions: 10,
      }
      const { legacy, idFirst, legacyIds, idFirstIds } = await runParity(params)

      expect(legacy.questions?.length).toBe(idFirst.questions?.length)
      expect(idFirstIds).toEqual(legacyIds)
    })

    it('numQuestions excede totalAvailable: ambas devuelven todo lo disponible', async () => {
      // Ley pequeña con pocos arts + numQuestions enorme
      const params: GetFilteredQuestionsRequest = {
        ...baseParams,
        selectedLaws: ['CE'],
        selectedArticlesByLaw: { 'CE': [1] }, // un solo artículo
        numQuestions: 500,
      }
      const { legacy, idFirst, legacyIds, idFirstIds } = await runParity(params)

      expect(legacy.questions?.length).toBe(idFirst.questions?.length)
      expect(idFirstIds).toEqual(legacyIds)
      // El número devuelto debe ser ≤ totalAvailable, NO 500
      expect(idFirst.questions?.length).toBeLessThan(500)
    })
  })

  describe('Filtros adicionales', () => {
    it('onlyOfficialQuestions=true: respeta filtro is_official_exam', async () => {
      const params: GetFilteredQuestionsRequest = {
        ...baseParams,
        topicNumber: 1,
        positionType: 'auxiliar_administrativo_estado',
        onlyOfficialQuestions: true,
        numQuestions: 10,
      }
      const { legacy, idFirst, legacyIds, idFirstIds } = await runParity(params)

      expect(legacy.questions?.length).toBe(idFirst.questions?.length)
      expect(idFirstIds).toEqual(legacyIds)

      // Si hay resultados, todas son oficiales
      for (const q of idFirst.questions || []) {
        expect(q.metadata.is_official_exam).toBe(true)
      }
    })

    it('focusEssentialArticles: filtra a artículos con al menos 1 pregunta oficial', async () => {
      const params: GetFilteredQuestionsRequest = {
        ...baseParams,
        topicNumber: 1,
        positionType: 'auxiliar_administrativo_estado',
        focusEssentialArticles: true,
        numQuestions: 10,
      }
      const { legacy, idFirst, legacyIds, idFirstIds } = await runParity(params)

      expect(legacy.questions?.length).toBe(idFirst.questions?.length)
      expect(idFirstIds).toEqual(legacyIds)
    })

    it('selectedSectionFilters con articleRange 1-50: respeta rango', async () => {
      const params: GetFilteredQuestionsRequest = {
        ...baseParams,
        topicNumber: 1,
        positionType: 'auxiliar_administrativo_estado',
        selectedSectionFilters: [{
          title: 'Test range',
          articleRange: { start: 1, end: 50 },
        }],
        numQuestions: 10,
      }
      const { legacy, idFirst, legacyIds, idFirstIds } = await runParity(params)

      expect(legacy.questions?.length).toBe(idFirst.questions?.length)
      expect(idFirstIds).toEqual(legacyIds)

      // Todos los artículos devueltos deben tener número 1-50
      for (const q of idFirst.questions || []) {
        const num = parseInt(q.article.number, 10)
        if (!isNaN(num)) expect(num).toBeGreaterThanOrEqual(1)
        if (!isNaN(num)) expect(num).toBeLessThanOrEqual(50)
      }
    })

    it('excludeRecentDays con userId real: ambas excluyen mismas preguntas', async () => {
      const params: GetFilteredQuestionsRequest = {
        ...baseParams,
        topicNumber: 1,
        positionType: 'auxiliar_administrativo_estado',
        excludeRecentDays: 7,
        userId: '3260627f-2018-4a5e-8234-e6f07015abb9',
        numQuestions: 10,
      }
      const { legacy, idFirst, legacyIds, idFirstIds } = await runParity(params)

      expect(legacy.questions?.length).toBe(idFirst.questions?.length)
      expect(idFirstIds).toEqual(legacyIds)
    })

    it('prioritizeNeverSeen con userId real: misma selección', async () => {
      const params: GetFilteredQuestionsRequest = {
        ...baseParams,
        topicNumber: 1,
        positionType: 'auxiliar_administrativo_estado',
        prioritizeNeverSeen: true,
        userId: '3260627f-2018-4a5e-8234-e6f07015abb9',
        numQuestions: 10,
      }
      const { legacy, idFirst, legacyIds, idFirstIds } = await runParity(params)

      expect(legacy.questions?.length).toBe(idFirst.questions?.length)
      expect(idFirstIds).toEqual(legacyIds)
    })
  })

  describe('Combinaciones complejas', () => {
    it('Multi-ley + onlyOfficial + selectedArticlesByLaw + difficultyMode', async () => {
      const params: GetFilteredQuestionsRequest = {
        ...baseParams,
        selectedLaws: ['CE', 'Ley 39/2015'],
        selectedArticlesByLaw: {
          'CE': [1, 2, 3, 14, 53],
          'Ley 39/2015': [1, 2, 3, 4, 5],
        },
        onlyOfficialQuestions: false, // si fuera true, podría dar empty
        difficultyMode: 'medium',
        numQuestions: 15,
      }
      const { legacy, idFirst, legacyIds, idFirstIds } = await runParity(params, 0.3)

      expect(legacy.questions?.length).toBe(idFirst.questions?.length)
      expect(idFirstIds).toEqual(legacyIds)
      expect(legacy.totalAvailable).toBe(idFirst.totalAvailable)
    })
  })
})

// ============================================
// PERFORMANCE BENCH (no es paridad, es métrica)
// ============================================
describeIfDb('Bench: tiempo de ejecución legacy vs idFirst', () => {
  jest.setTimeout(120_000)

  const benchScenarios: Array<{ name: string, params: GetFilteredQuestionsRequest }> = [
    {
      name: 'CE single law, 25 preguntas',
      params: { ...baseParams, selectedLaws: ['CE'], numQuestions: 25 },
    },
    {
      name: 'Multi-ley CE+L39+L40, 50 preguntas',
      params: { ...baseParams, selectedLaws: ['CE', 'Ley 39/2015', 'Ley 40/2015'], numQuestions: 50 },
    },
    {
      name: 'Auxiliar T3 multi-law scope, 25 preguntas',
      params: {
        ...baseParams,
        topicNumber: 3,
        positionType: 'auxiliar_administrativo_estado',
        numQuestions: 25,
      },
    },
  ]

  for (const { name, params } of benchScenarios) {
    it(`bench: ${name}`, async () => {
      // Warmup (descartar primer cold start)
      const restoreW = seedMath(0.5)
      await getFilteredQuestionsLegacy(params)
      await getFilteredQuestionsIdFirst(params)
      restoreW()

      const N = 3
      const legacyMs: number[] = []
      const idFirstMs: number[] = []

      for (let i = 0; i < N; i++) {
        const restoreA = seedMath(0.5)
        const t0 = Date.now()
        await getFilteredQuestionsLegacy(params)
        legacyMs.push(Date.now() - t0)
        restoreA()

        const restoreB = seedMath(0.5)
        const t1 = Date.now()
        await getFilteredQuestionsIdFirst(params)
        idFirstMs.push(Date.now() - t1)
        restoreB()
      }

      const avg = (arr: number[]) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
      const legacyAvg = avg(legacyMs)
      const idFirstAvg = avg(idFirstMs)
      const speedup = legacyAvg / Math.max(idFirstAvg, 1)

      // Reporta en el output del test runner (no es assertion estricto)
      console.log(`  📊 ${name}: legacy=${legacyAvg}ms (${legacyMs.join(',')}) vs idFirst=${idFirstAvg}ms (${idFirstMs.join(',')}) — speedup ${speedup.toFixed(2)}x`)

      // Sanity: idFirst NO debe ser DRAMÁTICAMENTE más lento que legacy.
      // No assertion estricta de speedup porque depende de pooler latency,
      // pero idFirst no debería ser >2x más lento (si sucediera, hay un bug).
      expect(idFirstAvg).toBeLessThan(legacyAvg * 3)
    })
  }
})

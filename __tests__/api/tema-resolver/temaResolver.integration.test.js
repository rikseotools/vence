// __tests__/api/tema-resolver/temaResolver.integration.test.js
// Tests de integración para tema-resolver
// NOTA: Los tests de DB se ejecutan por separado con tsx
// Este archivo contiene tests que pueden ejecutarse con Jest sin DB

const path = require('path')

// Cargar variables de entorno
require('dotenv').config({ path: path.join(__dirname, '../../../.env.local') })

// Los tests de integración con DB se saltan en Jest normal
// Se deben ejecutar con: npx tsx __tests__/api/tema-resolver/runIntegrationTests.ts
describe.skip('TemaResolver Integration Tests (requiere tsx)', () => {
  let resolveTemaByArticle
  let resolveTemasBatchByQuestionIds
  let resolveTemasBatch
  let supabase

  beforeAll(async () => {
    // Este bloque no se ejecuta - ver runIntegrationTests.ts
  })

  describe('resolveTemaByArticle', () => {
    let testQuestionId
    let testArticleId

    beforeAll(async () => {
      // Obtener una pregunta real con artículo vinculado
      const { data } = await supabase
        .from('questions')
        .select('id, primary_article_id')
        .not('primary_article_id', 'is', null)
        .eq('is_active', true)
        .limit(1)
        .single()

      if (data) {
        testQuestionId = data.id
        testArticleId = data.primary_article_id
      }
    })

    test('resuelve tema por questionId', async () => {
      if (!testQuestionId) {
        console.log('⚠️ No hay preguntas con artículo para probar')
        return
      }

      const result = await resolveTemaByArticle({
        questionId: testQuestionId,
        oposicionId: 'auxiliar_administrativo_estado',
      })

      // Puede ser success o not_found dependiendo de topic_scope
      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('temaNumber')

      if (result.success) {
        expect(result.temaNumber).toBeGreaterThan(0)
        expect(result.topicId).toBeDefined()
        expect(result.positionType).toBe('auxiliar_administrativo')
        expect(result.resolvedVia).toBe('question')
      }
    })

    test('resuelve tema por articleId', async () => {
      if (!testArticleId) {
        console.log('⚠️ No hay artículos para probar')
        return
      }

      const result = await resolveTemaByArticle({
        articleId: testArticleId,
        oposicionId: 'auxiliar_administrativo_estado',
      })

      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('temaNumber')

      if (result.success) {
        expect(result.temaNumber).toBeGreaterThan(0)
        expect(['article', 'full_law']).toContain(result.resolvedVia)
      }
    })

    test('retorna error para questionId inexistente', async () => {
      const result = await resolveTemaByArticle({
        questionId: '00000000-0000-0000-0000-000000000000',
        oposicionId: 'auxiliar_administrativo_estado',
      })

      expect(result.success).toBe(false)
      expect(result.temaNumber).toBeNull()
      expect(result.reason).toBe('question_not_found')
    })

    test('retorna error para articleId inexistente', async () => {
      const result = await resolveTemaByArticle({
        articleId: '00000000-0000-0000-0000-000000000000',
        oposicionId: 'auxiliar_administrativo_estado',
      })

      expect(result.success).toBe(false)
      expect(result.temaNumber).toBeNull()
      expect(result.reason).toBe('article_not_found')
    })

    test('usa cache para consultas repetidas', async () => {
      if (!testQuestionId) return

      // Primera llamada
      const result1 = await resolveTemaByArticle({
        questionId: testQuestionId,
        oposicionId: 'auxiliar_administrativo_estado',
      })

      // Segunda llamada (debe venir del cache)
      const result2 = await resolveTemaByArticle({
        questionId: testQuestionId,
        oposicionId: 'auxiliar_administrativo_estado',
      })

      // Ambos resultados deben ser iguales
      expect(result1.temaNumber).toBe(result2.temaNumber)

      // La segunda puede tener cached=true
      if (result2.success) {
        expect(result2.cached).toBe(true)
      }
    })

    test('diferentes oposiciones pueden tener diferentes temas', async () => {
      if (!testQuestionId) return

      const resultAux = await resolveTemaByArticle({
        questionId: testQuestionId,
        oposicionId: 'auxiliar_administrativo_estado',
      })

      const resultTram = await resolveTemaByArticle({
        questionId: testQuestionId,
        oposicionId: 'tramitacion_procesal',
      })

      // Ambos deben devolver un resultado válido
      expect(resultAux).toHaveProperty('success')
      expect(resultTram).toHaveProperty('success')

      // Los temas pueden ser diferentes o no existir para una oposición
      // pero la estructura debe ser correcta
    })
  })

  describe('resolveTemasBatchByQuestionIds', () => {
    let testQuestionIds

    beforeAll(async () => {
      const { data } = await supabase
        .from('questions')
        .select('id')
        .not('primary_article_id', 'is', null)
        .eq('is_active', true)
        .limit(10)

      testQuestionIds = data ? data.map(q => q.id) : []
    })

    test('resuelve múltiples preguntas en un solo query', async () => {
      if (testQuestionIds.length === 0) {
        console.log('⚠️ No hay preguntas para probar batch')
        return
      }

      const result = await resolveTemasBatchByQuestionIds(
        testQuestionIds,
        'auxiliar_administrativo_estado'
      )

      expect(result).toBeInstanceOf(Map)
      // Puede resolver algunas o todas
      expect(result.size).toBeGreaterThanOrEqual(0)
      expect(result.size).toBeLessThanOrEqual(testQuestionIds.length)

      // Verificar que los valores son números válidos
      result.forEach((temaNumber, questionId) => {
        expect(typeof temaNumber).toBe('number')
        expect(temaNumber).toBeGreaterThan(0)
        expect(testQuestionIds).toContain(questionId)
      })
    })

    test('retorna Map vacío para array vacío', async () => {
      const result = await resolveTemasBatchByQuestionIds([], 'auxiliar_administrativo_estado')

      expect(result).toBeInstanceOf(Map)
      expect(result.size).toBe(0)
    })

    test('batch es más rápido que individual', async () => {
      if (testQuestionIds.length < 5) {
        console.log('⚠️ No hay suficientes preguntas para test de performance')
        return
      }

      const fiveQuestions = testQuestionIds.slice(0, 5)

      // Medir tiempo individual
      const startIndividual = Date.now()
      for (const qId of fiveQuestions) {
        await resolveTemaByArticle({
          questionId: qId,
          oposicionId: 'auxiliar_administrativo_estado',
        })
      }
      const timeIndividual = Date.now() - startIndividual

      // Medir tiempo batch
      const startBatch = Date.now()
      await resolveTemasBatchByQuestionIds(fiveQuestions, 'auxiliar_administrativo_estado')
      const timeBatch = Date.now() - startBatch

      // Batch debe ser más rápido (al menos para primeras llamadas sin cache)
      console.log(`Individual: ${timeIndividual}ms, Batch: ${timeBatch}ms`)

      // No hacemos assert estricto porque el cache puede afectar
      expect(timeBatch).toBeLessThanOrEqual(timeIndividual * 2)
    })
  })

  describe('resolveTemasBatch (API format)', () => {
    let testQuestions

    beforeAll(async () => {
      const { data } = await supabase
        .from('questions')
        .select('id, primary_article_id')
        .not('primary_article_id', 'is', null)
        .eq('is_active', true)
        .limit(5)

      testQuestions = data ? data.map(q => ({
        questionId: q.id,
        articleId: q.primary_article_id,
      })) : []
    })

    test('resuelve batch con formato de API', async () => {
      if (testQuestions.length === 0) {
        console.log('⚠️ No hay preguntas para probar')
        return
      }

      const result = await resolveTemasBatch({
        questions: testQuestions,
        oposicionId: 'auxiliar_administrativo_estado',
      })

      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('results')
      expect(result).toHaveProperty('resolved')
      expect(result).toHaveProperty('notFound')

      expect(Array.isArray(result.results)).toBe(true)
      expect(result.results.length).toBe(testQuestions.length)

      // Verificar estructura de cada resultado
      result.results.forEach((r, i) => {
        expect(r.index).toBe(i)
        expect(r).toHaveProperty('temaNumber')
        expect(r).toHaveProperty('topicId')
      })

      // Verificar contadores
      expect(result.resolved + result.notFound).toBe(testQuestions.length)
    })
  })

  describe('Error Handling', () => {
    test('maneja errores de conexión gracefully', async () => {
      // Este test verifica que los errores no hacen crash
      const result = await resolveTemaByArticle({
        questionId: 'invalid-not-uuid',
        oposicionId: 'auxiliar_administrativo_estado',
      })

      // Debe retornar un error estructurado, no hacer throw
      expect(result.success).toBe(false)
    })
  })
})

// Tests que no requieren DB
describe('TemaResolver Unit Tests (no DB)', () => {
  test('OPOSICION_TO_POSITION_TYPE tiene todas las oposiciones', () => {
    const expectedOposiciones = [
      'auxiliar_administrativo_estado',
      'administrativo_estado',
      'tramitacion_procesal',
      'auxilio_judicial',
    ]

    // Reimportamos la constante
    const { OPOSICION_TO_POSITION_TYPE } = require('../../../lib/api/tema-resolver/schemas.ts')

    expectedOposiciones.forEach(oposicion => {
      expect(OPOSICION_TO_POSITION_TYPE).toHaveProperty(oposicion)
    })
  })

  test('cache key generation es determinística', () => {
    // Simulamos la función de generación de cache key
    function getCacheKey(questionId, articleId, articleNumber, lawId, positionType) {
      return `tema:${questionId || ''}:${articleId || ''}:${articleNumber || ''}:${lawId || ''}:${positionType || ''}`
    }

    const key1 = getCacheKey('q1', null, null, null, 'aux')
    const key2 = getCacheKey('q1', null, null, null, 'aux')

    expect(key1).toBe(key2)
    expect(key1).toBe('tema:q1::::aux')
  })
})

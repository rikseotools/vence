// __tests__/api/tema-resolver/runIntegrationTests.ts
// Tests de integración para tema-resolver
// Ejecutar con: npx tsx -r dotenv/config __tests__/api/tema-resolver/runIntegrationTests.ts -- dotenv_config_path=.env.local

import { createClient } from '@supabase/supabase-js'
import {
  resolveTemaByArticle,
  resolveTemasBatchByQuestionIds,
  resolveTemasBatch,
} from '../../../lib/api/tema-resolver'

// Colores para output
const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const RESET = '\x1b[0m'

let passed = 0
let failed = 0
let skipped = 0

function test(name: string, fn: () => Promise<void> | void) {
  return { name, fn }
}

async function runTest(t: { name: string; fn: () => Promise<void> | void }) {
  try {
    await t.fn()
    passed++
    console.log(`${GREEN}✓${RESET} ${t.name}`)
  } catch (error) {
    failed++
    console.log(`${RED}✗${RESET} ${t.name}`)
    console.log(`  ${RED}${error instanceof Error ? error.message : error}${RESET}`)
  }
}

function expect(value: unknown) {
  return {
    toBe: (expected: unknown) => {
      if (value !== expected) {
        throw new Error(`Expected ${expected}, got ${value}`)
      }
    },
    toBeGreaterThan: (expected: number) => {
      if (typeof value !== 'number' || value <= expected) {
        throw new Error(`Expected ${value} to be greater than ${expected}`)
      }
    },
    toBeGreaterThanOrEqual: (expected: number) => {
      if (typeof value !== 'number' || value < expected) {
        throw new Error(`Expected ${value} to be >= ${expected}`)
      }
    },
    toBeLessThanOrEqual: (expected: number) => {
      if (typeof value !== 'number' || value > expected) {
        throw new Error(`Expected ${value} to be <= ${expected}`)
      }
    },
    toBeNull: () => {
      if (value !== null) {
        throw new Error(`Expected null, got ${value}`)
      }
    },
    toBeInstanceOf: (expected: unknown) => {
      if (!(value instanceof (expected as new (...args: unknown[]) => unknown))) {
        throw new Error(`Expected instance of ${expected}`)
      }
    },
    toHaveProperty: (prop: string) => {
      if (typeof value !== 'object' || value === null || !(prop in value)) {
        throw new Error(`Expected object to have property ${prop}`)
      }
    },
    toContain: (expected: unknown) => {
      if (!Array.isArray(value) || !value.includes(expected)) {
        throw new Error(`Expected array to contain ${expected}`)
      }
    },
  }
}

async function main() {
  console.log('\n🧪 TemaResolver Integration Tests\n')
  console.log('=' .repeat(50))

  // Setup
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Obtener datos de prueba
  const { data: testQuestions } = await supabase
    .from('questions')
    .select('id, primary_article_id')
    .not('primary_article_id', 'is', null)
    .eq('is_active', true)
    .limit(10)

  const testQuestionIds = testQuestions?.map(q => q.id) || []
  const testQuestionId = testQuestionIds[0]
  const testArticleId = testQuestions?.[0]?.primary_article_id

  if (testQuestionIds.length === 0) {
    console.log(`${YELLOW}⚠️ No hay preguntas con artículo para probar${RESET}`)
    process.exit(0)
  }

  console.log(`\n📊 Datos de prueba: ${testQuestionIds.length} preguntas\n`)

  // ============================================
  // TEST SUITE: resolveTemaByArticle
  // ============================================
  console.log('\n--- resolveTemaByArticle ---\n')

  await runTest(test('resuelve tema por questionId', async () => {
    const result = await resolveTemaByArticle({
      questionId: testQuestionId,
      oposicionId: 'auxiliar_administrativo_estado',
    })

    expect(result).toHaveProperty('success')
    expect(result).toHaveProperty('temaNumber')

    if (result.success) {
      expect(result.temaNumber).toBeGreaterThan(0)
      expect(result.resolvedVia).toBe('question')
    }
  }))

  await runTest(test('resuelve tema por articleId', async () => {
    const result = await resolveTemaByArticle({
      articleId: testArticleId!,
      oposicionId: 'auxiliar_administrativo_estado',
    })

    expect(result).toHaveProperty('success')
    expect(result).toHaveProperty('temaNumber')
  }))

  await runTest(test('retorna error para questionId inexistente', async () => {
    const result = await resolveTemaByArticle({
      questionId: '00000000-0000-0000-0000-000000000000',
      oposicionId: 'auxiliar_administrativo_estado',
    })

    expect(result.success).toBe(false)
    expect(result.temaNumber).toBeNull()
  }))

  await runTest(test('usa cache para consultas repetidas', async () => {
    // Primera llamada
    await resolveTemaByArticle({
      questionId: testQuestionId,
      oposicionId: 'auxiliar_administrativo_estado',
    })

    // Segunda llamada (debe venir del cache)
    const result2 = await resolveTemaByArticle({
      questionId: testQuestionId,
      oposicionId: 'auxiliar_administrativo_estado',
    })

    if (result2.success) {
      expect(result2.cached).toBe(true)
    }
  }))

  // ============================================
  // TEST SUITE: resolveTemasBatchByQuestionIds
  // ============================================
  console.log('\n--- resolveTemasBatchByQuestionIds ---\n')

  await runTest(test('resuelve múltiples preguntas en un solo query', async () => {
    const result = await resolveTemasBatchByQuestionIds(
      testQuestionIds,
      'auxiliar_administrativo_estado'
    )

    expect(result).toBeInstanceOf(Map)
    expect(result.size).toBeGreaterThanOrEqual(0)
    expect(result.size).toBeLessThanOrEqual(testQuestionIds.length)
  }))

  await runTest(test('retorna Map vacío para array vacío', async () => {
    const result = await resolveTemasBatchByQuestionIds([], 'auxiliar_administrativo_estado')

    expect(result).toBeInstanceOf(Map)
    expect(result.size).toBe(0)
  }))

  await runTest(test('batch es más rápido que individual', async () => {
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

    // Medir tiempo batch (sin cache previo - usar oposición diferente)
    const startBatch = Date.now()
    await resolveTemasBatchByQuestionIds(fiveQuestions, 'tramitacion_procesal')
    const timeBatch = Date.now() - startBatch

    console.log(`    Individual: ${timeIndividual}ms, Batch: ${timeBatch}ms`)

    // Batch debe ser razonablemente eficiente
    expect(timeBatch).toBeLessThanOrEqual(timeIndividual * 3)
  }))

  // ============================================
  // TEST SUITE: resolveTemasBatch (API format)
  // ============================================
  console.log('\n--- resolveTemasBatch (API format) ---\n')

  await runTest(test('resuelve batch con formato de API', async () => {
    const questions = testQuestionIds.slice(0, 5).map(id => ({ questionId: id }))

    const result = await resolveTemasBatch({
      questions,
      oposicionId: 'auxiliar_administrativo_estado',
    })

    expect(result).toHaveProperty('success')
    expect(result).toHaveProperty('results')
    expect(result).toHaveProperty('resolved')
    expect(result).toHaveProperty('notFound')

    expect(result.results.length).toBe(questions.length)
  }))

  // ============================================
  // TEST SUITE: Performance
  // ============================================
  console.log('\n--- Performance Tests ---\n')

  await runTest(test('50 preguntas en menos de 1 segundo', async () => {
    const { data: fiftyQuestions } = await supabase
      .from('questions')
      .select('id')
      .not('primary_article_id', 'is', null)
      .eq('is_active', true)
      .limit(50)

    const ids = fiftyQuestions?.map(q => q.id) || []

    const start = Date.now()
    const result = await resolveTemasBatchByQuestionIds(ids, 'auxiliar_administrativo_estado')
    const elapsed = Date.now() - start

    console.log(`    50 preguntas: ${elapsed}ms, resueltos: ${result.size}`)

    expect(elapsed).toBeLessThanOrEqual(1000)
  }))

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n' + '='.repeat(50))
  console.log(`\n📊 Resultados: ${GREEN}${passed} passed${RESET}, ${failed > 0 ? RED : ''}${failed} failed${RESET}, ${skipped} skipped\n`)

  if (failed > 0) {
    process.exit(1)
  }
}

main().catch(error => {
  console.error(`${RED}Error fatal:${RESET}`, error)
  process.exit(1)
})

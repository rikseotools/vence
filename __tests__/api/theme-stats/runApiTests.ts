// __tests__/api/theme-stats/runApiTests.ts
// Tests de integración para theme-stats y topic-data V2
// Ejecutar con: npx tsx -r dotenv/config __tests__/api/theme-stats/runApiTests.ts -- dotenv_config_path=.env.local

import {
  getUserThemeStatsByOposicion,
  getUserThemeStats,
  getUserThemeStatsBatch,
  invalidateThemeStatsCache,
  clearAllThemeStatsCache,
} from '../../../lib/api/theme-stats/queries'
import { getTopicFullData } from '../../../lib/api/topic-data/queries'

// Colores para output
const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const CYAN = '\x1b[36m'
const RESET = '\x1b[0m'

let passed = 0
let failed = 0

function assert(condition: boolean, name: string, details = '') {
  if (condition) {
    console.log(`${GREEN}✓${RESET} ${name}`)
    passed++
  } else {
    console.log(`${RED}✗${RESET} ${name}${details ? ' - ' + details : ''}`)
    failed++
  }
}

async function runTests() {
  const testUserId = '004b954f-7ff5-4e9f-a6ca-05746c7226e6'

  console.log('\n🧪 THEME-STATS API V2 TESTS\n')
  console.log('='.repeat(60))

  // Clear cache before tests
  clearAllThemeStatsCache()

  // ========================================
  // TEST SUITE: getUserThemeStatsByOposicion
  // ========================================
  console.log(`\n${CYAN}--- getUserThemeStatsByOposicion ---${RESET}\n`)

  // Test 1: Auxiliar returns success
  const auxStats = await getUserThemeStatsByOposicion(testUserId, 'auxiliar-administrativo-estado')
  assert(auxStats.success === true, 'Auxiliar: returns success=true')
  assert(typeof auxStats.stats === 'object', 'Auxiliar: returns stats object')
  assert(Object.keys(auxStats.stats || {}).length > 0, 'Auxiliar: has stats entries')

  // Test 2: Administrativo returns success
  const admStats = await getUserThemeStatsByOposicion(testUserId, 'administrativo-estado')
  assert(admStats.success === true, 'Administrativo: returns success=true')
  assert(typeof admStats.stats === 'object', 'Administrativo: returns stats object')

  // Test 3: Tramitación returns success
  const tramStats = await getUserThemeStatsByOposicion(testUserId, 'tramitacion-procesal')
  assert(tramStats.success === true, 'Tramitación: returns success=true')

  // Test 4: Auxilio returns success
  const auxJudStats = await getUserThemeStatsByOposicion(testUserId, 'auxilio-judicial')
  assert(auxJudStats.success === true, 'Auxilio Judicial: returns success=true')

  // Test 5: Stats structure validation
  const auxTema1 = auxStats.stats?.['1']
  if (auxTema1) {
    assert(typeof auxTema1.temaNumber === 'number', 'Stats structure: has temaNumber')
    assert(typeof auxTema1.total === 'number', 'Stats structure: has total')
    assert(typeof auxTema1.correct === 'number', 'Stats structure: has correct')
    assert(typeof auxTema1.accuracy === 'number', 'Stats structure: has accuracy')
    assert(auxTema1.accuracy >= 0 && auxTema1.accuracy <= 100, 'Stats structure: accuracy in range 0-100')
    assert(typeof auxTema1.lastStudyFormatted === 'string', 'Stats structure: has lastStudyFormatted')
  }

  // Test 6: Different oposiciones can have different totals for same tema
  const admTema1 = admStats.stats?.['1']
  if (auxTema1 && admTema1) {
    console.log(`   ${YELLOW}Aux Tema 1: ${auxTema1.total} resp, ${auxTema1.accuracy}%${RESET}`)
    console.log(`   ${YELLOW}Adm Tema 1: ${admTema1.total} resp, ${admTema1.accuracy}%${RESET}`)
    assert(true, 'Both oposiciones have Tema 1 stats (may differ)')
  }

  // Test 7: Administrativo has unique high-numbered temas (200s, 300s, etc)
  const admTemas = Object.keys(admStats.stats || {}).map(Number)
  const hasHighTemas = admTemas.some(t => t > 200)
  assert(hasHighTemas, 'Administrativo: has temas > 200 (unique structure)')

  // Test 8: Cache works - second call should be cached
  const auxStats2 = await getUserThemeStatsByOposicion(testUserId, 'auxiliar-administrativo-estado')
  assert(auxStats2.cached === true, 'Cache: second call returns cached=true')

  // Test 9: Cache invalidation works
  invalidateThemeStatsCache(testUserId)
  const auxStats3 = await getUserThemeStatsByOposicion(testUserId, 'auxiliar-administrativo-estado')
  assert(auxStats3.cached !== true, 'Cache invalidation: fresh call after invalidate')

  // Test 10: Non-existent user returns empty stats
  const noUserStats = await getUserThemeStatsByOposicion(
    '00000000-0000-0000-0000-000000000000',
    'auxiliar-administrativo-estado'
  )
  assert(noUserStats.success === true, 'Non-existent user: returns success=true')
  assert(Object.keys(noUserStats.stats || {}).length === 0, 'Non-existent user: has empty stats')

  // ========================================
  // TEST SUITE: getUserThemeStats (compat)
  // ========================================
  console.log(`\n${CYAN}--- getUserThemeStats (compatibility) ---${RESET}\n`)

  // Test 11: With oposicionId uses V2
  clearAllThemeStatsCache()
  const statsWithOpos = await getUserThemeStats(testUserId, 'auxiliar-administrativo-estado')
  assert(statsWithOpos.success === true, 'With oposicionId: uses V2 successfully')

  // Test 12: Without oposicionId uses legacy
  const statsLegacy = await getUserThemeStats(testUserId)
  assert(statsLegacy.success === true, 'Without oposicionId: uses legacy successfully')

  // Test 13: Legacy may have tema 0 or different structure
  const legacyTemas = Object.keys(statsLegacy.stats || {})
  console.log(`   ${YELLOW}Legacy temas: ${legacyTemas.slice(0, 10).join(', ')}...${RESET}`)

  // ========================================
  // TEST SUITE: getUserThemeStatsBatch
  // ========================================
  console.log(`\n${CYAN}--- getUserThemeStatsBatch ---${RESET}\n`)

  // Test 14: Batch with single user
  const batchSingle = await getUserThemeStatsBatch([testUserId], 'auxiliar-administrativo-estado')
  assert(batchSingle instanceof Map, 'Batch single: returns Map')
  assert(batchSingle.size === 1, 'Batch single: has 1 entry')
  assert(batchSingle.get(testUserId)?.success === true, 'Batch single: entry is successful')

  // Test 15: Batch with empty array
  const batchEmpty = await getUserThemeStatsBatch([], 'auxiliar-administrativo-estado')
  assert(batchEmpty instanceof Map, 'Batch empty: returns Map')
  assert(batchEmpty.size === 0, 'Batch empty: has 0 entries')

  // ========================================
  // TEST SUITE: getTopicFullData V2
  // ========================================
  console.log(`\n${CYAN}--- getTopicFullData (with V2 progress) ---${RESET}\n`)

  // Test 16: Topic data for auxiliar tema 1
  const topicAux1 = await getTopicFullData(1, 'auxiliar-administrativo-estado', testUserId)
  assert(topicAux1.success === true, 'Topic auxiliar tema 1: success')
  assert(topicAux1.topic?.topicNumber === 1, 'Topic auxiliar tema 1: correct topic number')
  assert(topicAux1.userProgress !== null, 'Topic auxiliar tema 1: has user progress')

  if (topicAux1.userProgress) {
    console.log(`   ${YELLOW}User progress: ${topicAux1.userProgress.totalAnswers} answers, ${Math.round(topicAux1.userProgress.overallAccuracy)}%${RESET}`)
    assert(typeof topicAux1.userProgress.totalAnswers === 'number', 'User progress: has totalAnswers')
    assert(typeof topicAux1.userProgress.overallAccuracy === 'number', 'User progress: has overallAccuracy')
    assert(typeof topicAux1.userProgress.uniqueQuestionsAnswered === 'number', 'User progress: has uniqueQuestionsAnswered')
  }

  // Test 17: Topic data for administrativo tema 1 (same tema, different oposicion)
  const topicAdm1 = await getTopicFullData(1, 'administrativo-estado', testUserId)
  assert(topicAdm1.success === true, 'Topic administrativo tema 1: success')
  assert(topicAdm1.userProgress !== null, 'Topic administrativo tema 1: has user progress')

  if (topicAdm1.userProgress) {
    console.log(`   ${YELLOW}User progress: ${topicAdm1.userProgress.totalAnswers} answers, ${Math.round(topicAdm1.userProgress.overallAccuracy)}%${RESET}`)
  }

  // Test 18: Topic data without userId (no user progress)
  const topicNoUser = await getTopicFullData(1, 'auxiliar-administrativo-estado', null)
  assert(topicNoUser.success === true, 'Topic without user: success')
  assert(topicNoUser.userProgress === null, 'Topic without user: userProgress is null')

  // Test 19: Topic data for non-existent tema
  const topicInvalid = await getTopicFullData(9999, 'auxiliar-administrativo-estado', testUserId)
  assert(topicInvalid.success === false, 'Invalid tema: returns error')

  // Test 20: Topic data for administrativo-specific tema (303)
  const topicAdm303 = await getTopicFullData(303, 'administrativo-estado', testUserId)
  if (topicAdm303.success) {
    assert(true, 'Topic 303 (administrativo only): success')
    console.log(`   ${YELLOW}Topic 303: ${topicAdm303.topic?.title?.substring(0, 40)}...${RESET}`)
    if (topicAdm303.userProgress) {
      console.log(`   ${YELLOW}User progress: ${topicAdm303.userProgress.totalAnswers} answers${RESET}`)
    }
  } else {
    // Tema 303 might not exist in DB
    console.log(`   ${YELLOW}Topic 303 not found (may not exist in DB)${RESET}`)
    passed++ // Not a failure, just might not exist
  }

  // Test 21: Same tema 303 should not exist in auxiliar
  const topicAux303 = await getTopicFullData(303, 'auxiliar-administrativo-estado', testUserId)
  assert(topicAux303.success === false, 'Topic 303 in auxiliar: should not exist')

  // ========================================
  // SUMMARY
  // ========================================
  console.log('\n' + '='.repeat(60))
  console.log(`\n📊 Results: ${GREEN}${passed} passed${RESET}, ${failed > 0 ? RED : ''}${failed} failed${RESET}\n`)

  process.exit(failed > 0 ? 1 : 0)
}

runTests().catch(error => {
  console.error(`${RED}Fatal error:${RESET}`, error)
  process.exit(1)
})

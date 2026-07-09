/**
 * @jest-environment node
 */
// __tests__/integration/porLeyesScopeToPosition.integration.test.ts
//
// Integración (RDS real) de la feature "por leyes acotado a la oposición".
// Prueba el escenario EXACTO de Ana (administrativo_gva + LCSP):
//   - scopeToPosition=false → ley completa (arts >130 aparecen).
//   - scopeToPosition=true  → solo su temario (0 arts >130).
// Y que la lista de leyes se filtra por oposición (getAllLawsWithStats).
//
// Read-only, pero usa getDb() (postgres.js estricto con el cert self-signed de RDS),
// así que es opt-in (INTEGRATION_DB_WRITABLE=1) para no flakear el CI read-only.
// Correr en local:
//   NODE_TLS_REJECT_UNAUTHORIZED=0 INTEGRATION_DB_WRITABLE=1 \
//     npx jest __tests__/integration/porLeyesScopeToPosition.integration.test.ts
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local', override: true })
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = /sslmode=/.test(process.env.DATABASE_URL)
    ? process.env.DATABASE_URL.replace(/sslmode=[a-z-]+/, 'sslmode=no-verify')
    : process.env.DATABASE_URL + (process.env.DATABASE_URL.includes('?') ? '&' : '?') + 'sslmode=no-verify'
}

const canRun = !!process.env.DATABASE_URL && process.env.INTEGRATION_DB_WRITABLE === '1'
const describeIfDb = canRun ? describe : describe.skip

type GetFiltered = typeof import('@/lib/api/filtered-questions/queries')['getFilteredQuestions']
type GetLaws = typeof import('@/lib/api/laws-configurator/queries')['getAllLawsWithStats']

describeIfDb('por leyes — scopeToPosition (escenario Ana, RDS real)', () => {
  let getFilteredQuestions: GetFiltered
  let getAllLawsWithStats: GetLaws

  beforeAll(async () => {
    delete (globalThis as unknown as { db?: unknown }).db
    getFilteredQuestions = (await import('@/lib/api/filtered-questions/queries')).getFilteredQuestions
    getAllLawsWithStats = (await import('@/lib/api/laws-configurator/queries')).getAllLawsWithStats
  })

  const base = (scopeToPosition: boolean) => ({
    topicNumber: 0, positionType: 'administrativo_gva', multipleTopics: [], numQuestions: 60,
    selectedLaws: ['Ley 9/2017'], selectedArticlesByLaw: {}, selectedSectionFilters: [],
    onlyOfficialQuestions: false, includeSharedOfficials: false, difficultyMode: 'random' as const,
    excludeRecentDays: 0, focusEssentialArticles: false, prioritizeNeverSeen: false,
    proportionalByTopic: false, onlyFailedQuestions: false, failedQuestionIds: [], primaryArticleIds: [],
    scopeToPosition,
  })
  const arts = (r: Awaited<ReturnType<GetFiltered>>) =>
    (r.questions || []).map(q => Number((q.article as { number?: string })?.number)).filter(n => !isNaN(n))

  test('scopeToPosition=false sirve la LCSP entera (arts >130 presentes)', async () => {
    const r = await getFilteredQuestions(base(false) as Parameters<GetFiltered>[0])
    const over = arts(r).filter(n => n > 130)
    expect(over.length).toBeGreaterThan(0)
  })

  test('scopeToPosition=true acota al temario GVA (0 arts >130)', async () => {
    const r = await getFilteredQuestions(base(true) as Parameters<GetFiltered>[0])
    const nums = arts(r)
    expect(nums.length).toBeGreaterThan(0)
    expect(nums.filter(n => n > 130)).toHaveLength(0)
  })

  test('getAllLawsWithStats(positionType) filtra a las leyes de la oposición', async () => {
    const all = await getAllLawsWithStats()
    const gva = await getAllLawsWithStats('administrativo_gva')
    expect((gva.data?.length ?? 0)).toBeGreaterThan(0)
    expect((gva.data?.length ?? 0)).toBeLessThan(all.data?.length ?? 0)
  })
})

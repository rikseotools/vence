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

// Queries contra RDS real; el conteo "todas las leyes" (sin filtro) sobre 894 leyes
// tarda ~3s legítimamente. Margen para no flakear el default de 10s de jest.
jest.setTimeout(30000)

type GetFiltered = typeof import('@/lib/api/filtered-questions/queries')['getFilteredQuestions']
type GetLaws = typeof import('@/lib/api/laws-configurator/queries')['getAllLawsWithStats']
type GetArticles = typeof import('@/lib/api/test-config/queries')['getArticlesForLaw']

describeIfDb('por leyes — scopeToPosition (escenario Ana, RDS real)', () => {
  let getFilteredQuestions: GetFiltered
  let getAllLawsWithStats: GetLaws
  let getArticlesForLaw: GetArticles

  beforeAll(async () => {
    delete (globalThis as unknown as { db?: unknown }).db
    getFilteredQuestions = (await import('@/lib/api/filtered-questions/queries')).getFilteredQuestions
    getAllLawsWithStats = (await import('@/lib/api/laws-configurator/queries')).getAllLawsWithStats
    getArticlesForLaw = (await import('@/lib/api/test-config/queries')).getArticlesForLaw
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

  // Auditoría (MEDIO): el conteo de una ley en modo acotado debe reflejar el temario,
  // no la ley entera (si no, la tarjeta miente: 715 vs 358 servidas).
  test('FIX conteo: LCSP acotado a GVA cuenta menos que la ley entera', async () => {
    const all = await getAllLawsWithStats()
    const gva = await getAllLawsWithStats('administrativo_gva')
    const lcspAll = all.data?.find(l => l.lawShortName === 'Ley 9/2017')
    const lcspGva = gva.data?.find(l => l.lawShortName === 'Ley 9/2017')
    expect(lcspGva?.totalQuestions ?? 0).toBeGreaterThan(0)
    expect(lcspGva!.totalQuestions).toBeLessThan(lcspAll!.totalQuestions)
  })

  // Auditoría (MEDIO): el SELECTOR de artículos en modo acotado no debe ofrecer arts
  // fuera del temario (la confusión de Ana: veía LCSP >130 en el selector).
  test('FIX selector: getArticlesForLaw acotado no ofrece arts >130 (GVA/LCSP)', async () => {
    const p = { lawShortName: 'Ley 9/2017', topicNumber: null, positionType: 'administrativo_gva', includeOfficialCount: false }
    const full = await getArticlesForLaw({ ...p, scopeToPosition: false } as Parameters<GetArticles>[0])
    const scoped = await getArticlesForLaw({ ...p, scopeToPosition: true } as Parameters<GetArticles>[0])
    const maxArt = (r: Awaited<ReturnType<GetArticles>>) => Math.max(...(r.articles || []).map(a => Number(a.article_number)).filter(n => !isNaN(n)))
    expect((scoped.articles?.length ?? 0)).toBeGreaterThan(0)
    expect(maxArt(scoped)).toBeLessThanOrEqual(130)
    expect(maxArt(full)).toBeGreaterThan(130) // sin acotar sí los ofrece
  })

  // Auditoría (MEDIO/BAJO): selección manual de un art fuera del temario + scoped NO
  // debe colarse (intersección manual∩scope; cubre también la vía URL ?articles=…&scoped=1).
  test('FIX intersección: art manual fuera del temario + scoped → 0 preguntas', async () => {
    const p = { ...base(true), selectedArticlesByLaw: { 'Ley 9/2017': [300] } }
    const r = await getFilteredQuestions(p as Parameters<GetFiltered>[0])
    expect(r.questions || []).toHaveLength(0)
  })
})

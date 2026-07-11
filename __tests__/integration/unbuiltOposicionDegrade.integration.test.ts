/**
 * @jest-environment node
 */
// __tests__/integration/unbuiltOposicionDegrade.integration.test.ts
//
// Integración (RDS real) del INCIDENTE Alfonso (11/07/2026): usuario premium con
// oposición 'bibliotecario' (SIN temario construido → 0 filas en topic_scope) que
// pedía 100 preguntas de la Ley 39/2015 acotadas y recibía "error al crear el test".
//
// Dos capas verificadas end-to-end contra la BD viva:
//   1) El schema ya NO da 400 con positionType desconocido (probado en unit).
//   2) queries.ts DEGRADA con gracia: sin temario para esa ley → sirve la selección
//      EXPLÍCITA del usuario (no un test vacío). Y una oposición CON temario sigue
//      intersecando (defensa en profundidad, sin regresión).
//
// Read-only, pero usa getDb() (postgres.js estricto con el cert self-signed de RDS),
// así que es opt-in (INTEGRATION_DB_WRITABLE=1) para no flakear el CI read-only.
// Correr en local:
//   NODE_TLS_REJECT_UNAUTHORIZED=0 INTEGRATION_DB_WRITABLE=1 \
//     npx jest __tests__/integration/unbuiltOposicionDegrade.integration.test.ts
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

jest.setTimeout(30000)

type GetFiltered = typeof import('@/lib/api/filtered-questions/queries')['getFilteredQuestions']

describeIfDb('oposición sin construir → degradación con gracia (incidente Alfonso, RDS real)', () => {
  let getFilteredQuestions: GetFiltered

  // Los 3 títulos de la Ley 39/2015 que pidió Alfonso (del referrer real).
  const ALFONSO_ARTS = [1, 2, 3, 4, 5, 7, 8, 9, 11, 12, 10, 34, 35, 36, 37, 38, 39,
    40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52]

  beforeAll(async () => {
    delete (globalThis as unknown as { db?: unknown }).db
    getFilteredQuestions = (await import('@/lib/api/filtered-questions/queries')).getFilteredQuestions
  })

  const base = (positionType: string, scopeToPosition: boolean) => ({
    topicNumber: 0, positionType, multipleTopics: [], numQuestions: 100,
    selectedLaws: ['Ley 39/2015'],
    selectedArticlesByLaw: { 'Ley 39/2015': ALFONSO_ARTS },
    selectedSectionFilters: [], onlyOfficialQuestions: false, includeSharedOfficials: false,
    difficultyMode: 'random' as const, excludeRecentDays: 0, focusEssentialArticles: false,
    prioritizeNeverSeen: false, proportionalByTopic: false, onlyFailedQuestions: false,
    failedQuestionIds: [], primaryArticleIds: [], scopeToPosition,
  })

  const artNums = (r: Awaited<ReturnType<GetFiltered>>) =>
    (r.questions || []).map(q => String((q.article as { number?: string })?.number))

  test('bibliotecario (sin temario) + scopeToPosition=true → sirve las preguntas pedidas, NO test vacío', async () => {
    const r = await getFilteredQuestions(base('bibliotecario', true))
    expect(r.success).toBe(true)
    expect((r.questions?.length ?? 0)).toBeGreaterThanOrEqual(50) // pidió 100; hay >700 disponibles
    // Todo dentro de los artículos que el usuario eligió (nada fuera).
    const pedido = new Set(ALFONSO_ARTS.map(String))
    expect(artNums(r).every(a => pedido.has(a))).toBe(true)
    // Solo Ley 39/2015.
    const laws = new Set((r.questions || []).map(q => (q.article as { law_short_name?: string })?.law_short_name))
    expect([...laws]).toEqual(['Ley 39/2015'])
  })

  test('bibliotecario con n=50 tampoco da error (la queja literal: "ni 100 ni 50")', async () => {
    const r = await getFilteredQuestions({ ...base('bibliotecario', true), numQuestions: 50 })
    expect(r.success).toBe(true)
    expect((r.questions?.length ?? 0)).toBeGreaterThan(0)
  })

  test('regresión: oposición CON temario sigue acotando (no cuela artículos fuera de scope)', async () => {
    // aux_estado tiene un temario PARCIAL de "Access 365" (art 3 dentro, art 5 fuera).
    // Si la degradación se aplicara por error a oposiciones con temario, el art 5 colaría.
    const r = await getFilteredQuestions({
      ...base('auxiliar_administrativo_estado', true),
      selectedLaws: ['Access 365'],
      selectedArticlesByLaw: { 'Access 365': [3, 5] },
      numQuestions: 50,
    })
    expect(r.success).toBe(true)
    const served = new Set(artNums(r))
    expect(served.has('5')).toBe(false) // fuera de scope → filtrado
  })
})

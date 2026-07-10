/**
 * @jest-environment node
 */
// __tests__/integration/articleTestCount.integration.test.ts
//
// SSOT del CTA "Hacer test de este artículo" (fix bug manuel izquierdo, 10/07).
// El conteo del CTA (countLawArticleServedQuestions) DEBE coincidir con lo que
// el usuario realmente recibe al lanzar el test (getFilteredQuestions, la MISMA
// función que sirve /api/questions/filtered), para su OPOSICIÓN. Así se garantiza
// CERO dead-ends para todas las oposiciones — incluida Policía Nacional (tag 'PN'
// exclusivo), que fue el escenario que las dos revisiones adversariales cazaron.
import dotenv from 'dotenv'
import { getFilteredQuestions, countLawArticleServedQuestions } from '@/lib/api/filtered-questions'
import { getShortNameBySlug } from '@/lib/api/laws'

dotenv.config({ path: '.env.local', override: true })
// getFilteredQuestions y la fn de conteo usan el cliente Drizzle (postgres-js),
// sensible a sslmode en la URL: NO reescribir la URL, basta NODE_TLS_REJECT.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip

// Réplica del request que arma LawTestPageWrapper para el path law-only.
async function servedByTest(lawShortName: string, articleNumber: number, positionType: string) {
  const res = await getFilteredQuestions({
    topicNumber: 0,
    positionType: positionType as never,
    numQuestions: 500, // alto → sin cap para un solo artículo
    selectedLaws: [lawShortName],
    selectedArticlesByLaw: { [lawShortName]: [articleNumber] },
    selectedSectionFilters: [],
    onlyOfficialQuestions: false,
  } as never)
  return res.questions.length
}

describeIfDb('CTA test por artículo — SSOT conteo == servido (RDS)', () => {
  const POSITIONS = ['auxiliar_administrativo_estado', 'auxiliar_administrativo_valencia', 'policia_nacional']

  // Casos con nombre corto conocido (slug → short_name).
  const CASES: Array<{ slug: string; art: number }> = [
    { slug: 'decreto-42-2019-condiciones-trabajo-gva', art: 10 }, // ley GVA
    { slug: 'decreto-42-2019-condiciones-trabajo-gva', art: 9 },
    { slug: 'codigo-penal', art: 36 }, // solo oficiales → estado sirve 0 (dead-end del review)
    { slug: 'ley-39-2015', art: 96 }, // general con oficiales de varias oposiciones (escenario PN del review)
  ]

  test('INVARIANTE no-dead-end + exactitud: conteo == nº preguntas que sirve el test, ∀ oposición', async () => {
    for (const { slug, art } of CASES) {
      const shortName = await getShortNameBySlug(slug)
      expect(shortName).toBeTruthy()
      for (const pos of POSITIONS) {
        const count = await countLawArticleServedQuestions(shortName as string, art, pos)
        const served = await servedByTest(shortName as string, art, pos)
        // El corazón del fix: el CTA aparece EXACTAMENTE cuando hay preguntas, y
        // el nº mostrado == nº servido (nunca dead-end, nunca sobre/infra-conteo).
        expect(count).toBe(served)
      }
    }
  }, 120000)

  test('art 0 / no numérico → 0 (rompería el round-trip "Volver al artículo")', async () => {
    const shortName = (await getShortNameBySlug('decreto-42-2019-condiciones-trabajo-gva')) as string
    expect(await countLawArticleServedQuestions(shortName, 0, 'auxiliar_administrativo_estado')).toBe(0)
    expect(await countLawArticleServedQuestions(shortName, -3, 'auxiliar_administrativo_estado')).toBe(0)
  }, 30000)

  test('ley inexistente → 0 (sin crash)', async () => {
    expect(await countLawArticleServedQuestions('__ley_que_no_existe__', 1, 'auxiliar_administrativo_estado')).toBe(0)
  }, 30000)
})

/**
 * Test de integración: verifica que las preguntas con `exam_case_id` NO IS NULL
 * (es decir, parte de un caso práctico narrativo) se excluyen de todos los
 * endpoints que cargan preguntas para tests aislados.
 *
 * Contexto: las preguntas de casos prácticos (Auxilio Judicial 2º ej, Tramit.
 * Procesal 2º ej) referencian un texto narrativo compartido almacenado en
 * `exam_cases`. Solo `OfficialExamLayout` y `ExamReviewLayout` cargan y
 * renderizan el caso encima de las preguntas. En tests aislados (aleatorio,
 * por ley, por tema, falladas, simulacro generado) aparecerían SIN contexto
 * → incomprensibles para el usuario.
 *
 * El parche añade `isNull(questions.examCaseId)` al WHERE de 6 endpoints. Este
 * test verifica el comportamiento contra BD real.
 *
 * Si este test falla:
 *   - Un endpoint nuevo carga preguntas sin filtrar exam_case_id → añadir filtro
 *   - O un cambio rompió el filtro existente → revertir
 *
 * Endpoints cubiertos: random-test, random-test-data, topic-data,
 * user-failed-questions (no se prueba directamente — query depende de
 * test_questions del usuario), filtered-questions, simulacro.
 */

import dotenv from 'dotenv'
import { Client } from 'pg'

dotenv.config({ path: '.env.local', override: true })

const DB_URL = process.env.DATABASE_URL
const hasDb = !!DB_URL

describe('exam_case_id exclusion in isolated tests', () => {
  if (!hasDb) {
    test.skip('Skipped: DATABASE_URL no configurado', () => {})
    return
  }

  let client: Client
  beforeAll(async () => {
    client = new Client({ connectionString: DB_URL })
    await client.connect()
  })
  afterAll(async () => { await client?.end() })

  test('Setup: hay preguntas con exam_case_id IS NOT NULL en BD', async () => {
    const { rows } = await client.query('SELECT id FROM questions WHERE exam_case_id IS NOT NULL LIMIT 1')
    expect(rows.length).toBeGreaterThan(0)
  }, 15000)

  test('Setup: tabla exam_cases tiene al menos 1 fila', async () => {
    const { rows } = await client.query('SELECT id FROM exam_cases LIMIT 1')
    expect(rows.length).toBeGreaterThan(0)
  }, 15000)

  // Invariante AUTO-MANTENIDA (sustituye a un allowlist hardcodeado que se
  // quedaba stale con cada oposición nueva que importa supuestos): toda pregunta
  // con exam_case_id DEBE referenciar una fila real de exam_cases. Así el
  // OfficialExamLayout siempre puede renderizar el caso; una pregunta con
  // exam_case_id colgando (sin caso) aparecería sin contexto → incomprensible.
  test('todo exam_case_id referencia una fila real de exam_cases (0 huérfanos)', async () => {
    const { rows } = await client.query<{ id: string; exam_position: string | null }>(`
      SELECT q.id, q.exam_position
      FROM questions q
      WHERE q.exam_case_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM exam_cases e WHERE e.id = q.exam_case_id)
      LIMIT 20
    `)
    if (rows.length > 0) {
      console.error(`${rows.length} preguntas con exam_case_id huérfano:`)
      rows.forEach(r => console.error(`  ${r.id} (${r.exam_position})`))
    }
    expect(rows).toHaveLength(0)
  }, 15000)

  test('OfficialExamLayout query SÍ devuelve preguntas con exam_case_id (debe mostrarlas con caso)', async () => {
    // getOfficialExamQuestions filtra por parte. Cuando parte=supuesto se
    // INCLUYEN preguntas con exam_case_id (es el modo correcto).
    const { rows } = await client.query(`
      SELECT exam_case_id FROM questions
      WHERE exam_position = 'auxilio_judicial' AND is_official_exam = true
        AND exam_source ILIKE '%Segunda parte%' AND exam_case_id IS NOT NULL
      LIMIT 50
    `)
    expect(rows.length).toBeGreaterThan(0)
    rows.forEach((r) => expect(r.exam_case_id).not.toBeNull())
  }, 15000)

  test('Conteo total preguntas con exam_case_id (≥ 86)', async () => {
    const { rows } = await client.query('SELECT count(*)::int AS n FROM questions WHERE exam_case_id IS NOT NULL')
    expect(rows[0].n).toBeGreaterThanOrEqual(86)
  }, 15000)
})

describe('Drizzle queries: filtros isNull(exam_case_id) están aplicados en código', () => {
  // Estos tests son estáticos: leen el código fuente y verifican que el filtro
  // está presente. Sirven como guardia anti-regresión: si alguien elimina el
  // filtro accidentalmente, el test falla.
  const fs = require('fs')

  const endpoints = [
    {
      file: 'lib/api/random-test/queries.ts',
      mustContain: 'isNull(questions.examCaseId)',
      description: 'random-test (test aleatorio por temas)',
    },
    {
      file: 'lib/api/random-test-data/queries.ts',
      mustContain: 'isNull(questions.examCaseId)',
      description: 'random-test-data (conteo por tema en UI)',
    },
    {
      file: 'lib/api/topic-data/queries.ts',
      mustContain: 'isNull(questions.examCaseId)',
      description: 'topic-data (test por tema)',
    },
    {
      file: 'lib/api/user-failed-questions/queries.ts',
      mustContain: 'isNull(questions.examCaseId)',
      description: 'user-failed-questions (repasar falladas)',
    },
    {
      file: 'lib/api/filtered-questions/queries.ts',
      mustContain: 'isNull(questions.examCaseId)',
      description: 'filtered-questions (test por leyes)',
    },
    {
      file: 'lib/api/simulacro/queries.ts',
      mustContain: 'isNull(questions.examCaseId)',
      description: 'simulacro (110 preguntas con distribución oficial)',
    },
  ]

  test.each(endpoints)(
    '$file contiene filtro isNull(questions.examCaseId) — $description',
    ({ file, mustContain }) => {
      const content = fs.readFileSync(file, 'utf-8')
      expect(content).toContain(mustContain)
    }
  )
})

/** @jest-environment node */
// __tests__/integration/examPositionQueryIntegration.test.ts
// Test de integración contra BD real para verificar que los filtros de
// exam_position funcionan correctamente (AND, no OR).
//
// Lee de la BD VIVA (RDS) vía pg. NO Supabase (congelado desde 04/07).

import { EXAM_POSITION_MAP, getValidExamPositions } from '@/lib/config/exam-positions'
import dotenv from 'dotenv'
import { Client } from 'pg'

dotenv.config({ path: '.env.local', override: true })

const DB_URL = process.env.DATABASE_URL
const describeIfDb = DB_URL ? describe : describe.skip

interface Question {
  id: string
  exam_position: string | null
}

describeIfDb('BD Real: filtro exam_position', () => {
  let client: Client

  beforeAll(async () => {
    client = new Client({ connectionString: DB_URL })
    await client.connect()
  })

  afterAll(async () => { await client?.end() })

  // Preguntas oficiales activas cuyo exam_position (lower) está en la lista dada.
  async function officialByPositions(positions: string[], limit = 500): Promise<Question[]> {
    const lower = positions.map(p => p.toLowerCase())
    const { rows } = await client.query<Question>(
      `SELECT id, exam_position FROM questions
       WHERE is_official_exam = true AND is_active = true
         AND lower(exam_position) = ANY($1)
       LIMIT $2`,
      [lower, limit],
    )
    return rows
  }

  test('Estado y Madrid devuelven conjuntos disjuntos', async () => {
    const estadoQs = await officialByPositions(getValidExamPositions('auxiliar_administrativo_estado'))
    const madridQs = await officialByPositions(getValidExamPositions('auxiliar_administrativo_madrid'))
    const estadoIds = new Set(estadoQs.map(q => q.id))
    const overlap = madridQs.filter(q => estadoIds.has(q.id))
    expect(overlap.length).toBe(0)
  }, 30000)

  test('preguntas filtradas por Estado tienen exam_position correcto', async () => {
    const positions = getValidExamPositions('auxiliar_administrativo_estado')
    const lower = positions.map(p => p.toLowerCase())
    const questions = await officialByPositions(positions, 100)
    for (const q of questions) {
      expect(lower).toContain(q.exam_position?.toLowerCase())
    }
  }, 30000)

  test('preguntas filtradas por Madrid tienen exam_position correcto', async () => {
    const positions = getValidExamPositions('auxiliar_administrativo_madrid')
    const lower = positions.map(p => p.toLowerCase())
    const questions = await officialByPositions(positions, 100)
    expect(questions.length).toBeGreaterThan(0)
    for (const q of questions) {
      expect(lower).toContain(q.exam_position?.toLowerCase())
    }
  }, 30000)

  test('cada exam_position en BD está cubierto por EXAM_POSITION_MAP', async () => {
    const { rows } = await client.query<{ exam_position: string }>(
      `SELECT DISTINCT exam_position FROM questions
       WHERE is_official_exam = true AND is_active = true AND exam_position IS NOT NULL`,
    )
    const allMappedValues = Object.values(EXAM_POSITION_MAP).flat().map(v => v.toLowerCase())
    const bdValues = [...new Set(rows.map(r => r.exam_position?.toLowerCase()).filter(Boolean))]
    const unmapped = bdValues.filter(v => !allMappedValues.includes(v as string))
    if (unmapped.length > 0) {
      console.error('exam_position en BD sin mapear:', unmapped)
    }
    expect(unmapped.length).toBe(0)
  }, 30000)

  test('no hay preguntas oficiales activas sin exam_position (< 10%)', async () => {
    const { rows: [r] } = await client.query<{ sin: string; total: string }>(
      `SELECT count(*) FILTER (WHERE exam_position IS NULL)::text AS sin, count(*)::text AS total
       FROM questions WHERE is_official_exam = true AND is_active = true`,
    )
    const nullCount = Number(r.sin)
    const total = Number(r.total)
    const pctNull = total > 0 ? (nullCount / total) * 100 : 0
    if (nullCount > 0) {
      console.warn(`⚠️ ${nullCount}/${total} (${pctNull.toFixed(1)}%) preguntas oficiales sin exam_position`)
    }
    expect(pctNull).toBeLessThan(10)
  }, 30000)
})

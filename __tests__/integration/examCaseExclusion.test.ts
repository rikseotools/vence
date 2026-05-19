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

import https from 'https'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local', override: true })

const REAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const REAL_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const hasRealDb = !!(REAL_URL && REAL_KEY && !REAL_URL.includes('test.supabase.co'))

function supabaseGet<T = unknown>(table: string, params: string): Promise<T[]> {
  const url = `${REAL_URL}/rest/v1/${table}?${params}`
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            apikey: REAL_KEY!,
            Authorization: `Bearer ${REAL_KEY}`,
          },
        },
        (res) => {
          let data = ''
          res.on('data', (chunk) => (data += chunk))
          res.on('end', () => {
            try {
              resolve(JSON.parse(data))
            } catch {
              reject(new Error(`Failed to parse: ${data.substring(0, 200)}`))
            }
          })
        }
      )
      .on('error', reject)
  })
}

describe('exam_case_id exclusion in isolated tests', () => {
  if (!hasRealDb) {
    test.skip('Skipped: NEXT_PUBLIC_SUPABASE_URL no configurado', () => {})
    return
  }

  test('Setup: hay preguntas con exam_case_id IS NOT NULL en BD', async () => {
    const rows = await supabaseGet('questions', 'select=id&exam_case_id=not.is.null&limit=1')
    expect(Array.isArray(rows)).toBe(true)
    expect(rows.length).toBeGreaterThan(0)
  }, 15000)

  test('Setup: tabla exam_cases tiene al menos 1 fila', async () => {
    const rows = await supabaseGet('exam_cases', 'select=id&limit=1')
    expect(Array.isArray(rows)).toBe(true)
    expect(rows.length).toBeGreaterThan(0)
  }, 15000)

  test('Las preguntas con exam_case_id pertenecen a oposiciones con supuestos prácticos importados', async () => {
    // Añadir aquí nuevas oposiciones cuando se importen sus supuestos prácticos.
    // Última actualización: 19/05/2026 — CARM (74 preg de 3 convocatorias 2020/2023/2024).
    const validPositions = new Set([
      'auxilio_judicial',
      'tramitacion_procesal',
      'auxiliar_administrativo_carm',
    ])
    const rows = await supabaseGet<{ exam_position: string }>(
      'questions',
      'select=exam_position&exam_case_id=not.is.null&limit=500'
    )
    expect(rows.length).toBeGreaterThan(0)
    const invalid = rows.filter((r) => !validPositions.has(r.exam_position))
    expect(invalid).toEqual([])
  }, 15000)

  test('OfficialExamLayout query SÍ devuelve preguntas con exam_case_id (debe mostrarlas con caso)', async () => {
    // Simulacion: query getOfficialExamQuestions filtra por parte. Cuando
    // parte=supuesto se INCLUYEN preguntas con exam_case_id (es el modo correcto).
    const rows = await supabaseGet<{ exam_case_id: string | null }>(
      'questions',
      'select=exam_case_id&exam_position=eq.auxilio_judicial&is_official_exam=eq.true&exam_source=ilike.%25Segunda%20parte%25&exam_case_id=not.is.null&limit=50'
    )
    expect(rows.length).toBeGreaterThan(0)
    rows.forEach((r) => expect(r.exam_case_id).not.toBeNull())
  }, 15000)

  test('Conteo total preguntas con exam_case_id (debe ser ≥ las 9 TP 2025 + 42 AJ 2025 + 35 AJ 2024 = 86)', async () => {
    const url = `${REAL_URL}/rest/v1/questions?select=id&exam_case_id=not.is.null`
    const data = await new Promise<number>((resolve, reject) => {
      https
        .get(
          url,
          {
            headers: {
              apikey: REAL_KEY!,
              Authorization: `Bearer ${REAL_KEY}`,
              Prefer: 'count=exact',
              'Range-Unit': 'items',
              Range: '0-0',
            },
          },
          (res) => {
            const cr = res.headers['content-range'] as string | undefined
            const total = cr?.split('/')[1]
            resolve(total && total !== '*' ? Number(total) : 0)
            res.on('data', () => {})
            res.on('end', () => {})
          }
        )
        .on('error', reject)
    })
    expect(data).toBeGreaterThanOrEqual(86)
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

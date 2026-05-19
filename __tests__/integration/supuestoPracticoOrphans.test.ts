/**
 * Test de integración: detecta preguntas huérfanas de supuesto práctico.
 *
 * Contexto: las preguntas que forman parte de un supuesto práctico narrativo
 * deben tener `exam_case_id` apuntando a la fila correspondiente de
 * `exam_cases`. Sin esa vinculación, las preguntas son irresolubles porque
 * piden información que vive en el texto del supuesto ("según los datos del
 * supuesto", "de los mencionados", "del caso anterior", etc.).
 *
 * Bug histórico (19/05/2026): 74 preguntas de 3 convocatorias CARM (DGX00C18
 * 2020, DGX00C22 2023, DGX00L19 2024) estaban marcadas en `exam_source` como
 * "Supuesto práctico" pero con `exam_case_id = NULL`. Aparecían en tests
 * aislados (el filtro `isNull(examCaseId)` en los 6 endpoints las dejaba pasar)
 * sin contexto. Detectado por dispute de usuaria — resuelto importando los 6
 * `exam_cases` y vinculando. Manual: `docs/maintenance/impugnaciones-claude-code.md`
 * §7.4 y memoria `project_carm_supuestos_pendientes.md`.
 *
 * Este test detecta el patrón antes de que vuelva a llegar al usuario:
 *
 *   1. Por etiqueta: preguntas con `exam_source ILIKE '%Supuesto práctico%'`
 *      y `exam_case_id IS NULL` en estado visible (approved / tech_approved).
 *   2. Por heurística de texto: preguntas cuyo `question_text` contenga
 *      frases que solo tienen sentido con un supuesto adjunto.
 *
 * Si este test falla:
 *   - Importar el texto del supuesto a `exam_cases`.
 *   - `UPDATE questions SET exam_case_id` de las preguntas afectadas.
 *   - Si la pregunta no debería ser visible (ej. supuesto irrecuperable),
 *     transicionarla fuera de approved/tech_approved (needs_human / retired).
 */

import https from 'https'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local', override: true })

const REAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const REAL_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const hasRealDb = !!(REAL_URL && REAL_KEY && !REAL_URL.includes('test.supabase.co'))

interface QuestionRow {
  id: string
  exam_source: string | null
  question_text: string
  lifecycle_state: string
}

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

describe('Supuesto práctico orphans — preguntas que necesitan exam_case_id y no lo tienen', () => {
  if (!hasRealDb) {
    test.skip('Skipped: NEXT_PUBLIC_SUPABASE_URL no configurado', () => {})
    return
  }

  test('Ninguna pregunta visible con exam_source "Supuesto práctico" debe tener exam_case_id NULL', async () => {
    // PostgREST: ILIKE con `*` como wildcard. URL-encode del acento.
    const params = [
      'select=id,exam_source,lifecycle_state',
      'exam_source=ilike.*Supuesto%20pr%C3%A1ctico*',
      'exam_case_id=is.null',
      'lifecycle_state=in.(approved,tech_approved)',
      'limit=200',
    ].join('&')

    const rows = await supabaseGet<Pick<QuestionRow, 'id' | 'exam_source' | 'lifecycle_state'>>(
      'questions',
      params
    )

    if (rows.length > 0) {
      console.error('\n❌ HUÉRFANAS DE SUPUESTO PRÁCTICO (visibles sin contexto):')
      rows.forEach((r) =>
        console.error(`   - ${r.id} | ${r.lifecycle_state} | ${r.exam_source}`)
      )
      console.error(
        '\n   Fix: importar el supuesto narrativo a exam_cases y UPDATE exam_case_id.'
      )
      console.error(
        '   Manual: docs/maintenance/impugnaciones-claude-code.md §7.4\n'
      )
    }

    expect(rows).toEqual([])
  }, 20000)

  test('Heurística de texto: preguntas con frases que requieren contexto deben tener exam_case_id', async () => {
    // Patrones con alta especificidad: estas frases SOLO tienen sentido si hay
    // un supuesto narrativo adjunto que define personajes/situación.
    // Mantener la lista corta y precisa para evitar falsos positivos.
    const patterns = [
      'mencionados en el supuesto',
      'del supuesto anterior',
      'según los datos del supuesto',
      'datos del supuesto',
      'en el presente supuesto',
      'del caso anterior',
      'conforme al supuesto',
      'según el supuesto',
    ]

    const violations: Array<{ id: string; pattern: string; text: string }> = []

    for (const pat of patterns) {
      // PostgREST ILIKE con `*` como wildcard.
      const encoded = encodeURIComponent(pat).replace(/%20/g, '%20')
      const params = [
        'select=id,question_text,lifecycle_state',
        `question_text=ilike.*${encoded}*`,
        'exam_case_id=is.null',
        'lifecycle_state=in.(approved,tech_approved)',
        'limit=50',
      ].join('&')

      const rows = await supabaseGet<Pick<QuestionRow, 'id' | 'question_text' | 'lifecycle_state'>>(
        'questions',
        params
      )

      rows.forEach((r) =>
        violations.push({
          id: r.id,
          pattern: pat,
          text: r.question_text.slice(0, 120),
        })
      )
    }

    if (violations.length > 0) {
      console.error(
        '\n❌ PREGUNTAS VISIBLES SIN exam_case_id PERO CUYO TEXTO DEPENDE DE UN SUPUESTO:'
      )
      violations.forEach((v) =>
        console.error(`   - ${v.id} [match: "${v.pattern}"]\n     ${v.text}`)
      )
      console.error(
        '\n   Fix: vincular a exam_cases o reescribir question_text para que sea auto-suficiente.\n'
      )
    }

    expect(violations).toEqual([])
  }, 30000)

  test('Setup sanity: hay al menos 1 pregunta correctamente vinculada a exam_cases (control positivo)', async () => {
    // Sanity check: si este aserto falla, hay un problema con el dataset o la
    // query — los tests anteriores podrían estar dando falso negativo.
    const rows = await supabaseGet<{ id: string }>(
      'questions',
      'select=id&exam_case_id=not.is.null&limit=1'
    )
    expect(rows.length).toBeGreaterThan(0)
  }, 10000)
})

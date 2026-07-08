/**
 * @jest-environment node
 */
/**
 * Tests de calidad de datos para preguntas psicotécnicas activas.
 * Detectan problemas que causan mala experiencia al usuario:
 * - Opciones vacías o genéricas (solo "A", "B", "C", "D")
 * - Huecos en las opciones (option_b vacía con option_c presente)
 * - question_text que referencia visual sin content_data
 * - correct_option inválido
 * - question_subtype desconocido
 *
 * Lee de la BD VIVA (RDS) vía pg. NO Supabase (congelado desde 04/07) — el dato
 * de Supabase está desactualizado y desaparecerá al decomisionarlo.
 */

import dotenv from 'dotenv'
import { Client } from 'pg'

dotenv.config({ path: '.env.local', override: true })

const DB_URL = process.env.DATABASE_URL
const hasDb = !!DB_URL

interface PsyQuestion {
  id: string
  question_text: string
  option_a: string | null
  option_b: string | null
  option_c: string | null
  option_d: string | null
  content_data: Record<string, unknown> | null
  question_subtype: string
  correct_option: number | null
  image_url: string | null
}

// Patterns that indicate the question needs visual data (table, chart, image) to be answerable.
// "observe el siguiente grupo de palabras" is self-contained (the words follow in question_text).
const NEEDS_VISUAL_REGEX = /siguiente tabla|siguiente cuadro|siguiente gráfico|siguiente diagrama|tabla mostrad[oa]|mostrad[oa] a continuación|anexo Excel|anexo Word|observe la imagen|CUADRO.BASE/i
// Patterns that look visual but are actually self-contained
const SELF_CONTAINED_REGEX = /siguiente grupo de palabras|observe el siguiente grupo/i

const KNOWN_SUBTYPES = new Set([
  'text_question', 'synonym', 'antonym', 'analogy', 'definition',
  'classification', 'calculation', 'percentage', 'probability',
  'alphabetical', 'alphabetical_order', 'code_equivalence', 'coding',
  'sequence_numeric', 'sequence_letter', 'sequence_alphanumeric',
  'pie_chart', 'bar_chart', 'line_chart', 'mixed_chart',
  'data_tables', 'error_detection', 'word_analysis',
  // Importados de Guardia Civil (mayo 2026) — el frontend ya los maneja
  // en PsychometricTestLayout.tsx (cases en línea 608-609).
  'silogismo', 'agilidad_mental',
])

const describeIfDb = hasDb ? describe : describe.skip

describeIfDb('Psychometric questions data quality', () => {
  let client: Client
  let questions: PsyQuestion[]

  beforeAll(async () => {
    client = new Client({ connectionString: DB_URL })
    await client.connect()
    const { rows } = await client.query<PsyQuestion>(`
      SELECT id, question_text, option_a, option_b, option_c, option_d,
             content_data, question_subtype, correct_option, image_url
      FROM psychometric_questions
      WHERE is_active = true
    `)
    questions = rows
  }, 60000)

  afterAll(async () => {
    await client?.end()
  })

  test('should have active questions loaded', () => {
    expect(questions.length).toBeGreaterThan(100)
  })

  test('no options should be just single letters A/B/C/D (except known valid patterns)', () => {
    const bad = questions.filter(q => {
      // sequence_letter: answers are single letters (a, b, c...)
      // data_tables: classification questions where options ARE the categories (A, B, C, D)
      if (['sequence_letter', 'data_tables'].includes(q.question_subtype)) return false
      const opts = [q.option_a, q.option_b, q.option_c, q.option_d]
      if (!opts.every(o => /^[A-D]\.?$/.test((o || '').trim()))) return false
      // "marque la letra" questions: the answer IS a letter by design (instruction exercises)
      if (/marque.*letra|señale.*opción/i.test(q.question_text || '')) return false
      return true
    })

    if (bad.length > 0) {
      console.warn(`${bad.length} questions with single-letter options:`)
      bad.slice(0, 5).forEach(q => console.warn(`  ${q.id}: A=${q.option_a} B=${q.option_b}`))
    }
    expect(bad).toHaveLength(0)
  })

  // Una pregunta válida tiene sus opciones rellenas de forma CONTIGUA desde A.
  // 4 opciones (A-D) es lo normal; 3 opciones (A-C, option_d null) es válido y
  // el frontend lo renderiza bien (guard en PsychometricTestLayout). Lo que NO
  // es válido es un HUECO (p.ej. B vacía con C rellena) ni menos de 3 opciones.
  test('opciones contiguas desde A, mínimo 3, sin huecos', () => {
    const bad = questions.filter(q => {
      const opts = [q.option_a, q.option_b, q.option_c, q.option_d]
      const filled = opts.map(o => !!(o && o.trim()))
      const count = filled.filter(Boolean).length
      if (count < 3) return true // menos de 3 opciones reales
      // hueco: una opción vacía seguida de una rellena
      for (let i = 0; i < filled.length - 1; i++) {
        if (!filled[i] && filled[i + 1]) return true
      }
      return false
    })

    if (bad.length > 0) {
      console.warn(`${bad.length} questions with option gaps / <3 options:`)
      bad.slice(0, 5).forEach(q => console.warn(`  ${q.id}: A="${q.option_a}" B="${q.option_b}" C="${q.option_c}" D="${q.option_d}"`))
    }
    expect(bad).toHaveLength(0)
  })

  test('no question_text referencing visual content without content_data or image_url', () => {
    const bad = questions.filter(q => {
      const qt = q.question_text || ''
      const needsVisual = NEEDS_VISUAL_REGEX.test(qt) && !SELF_CONTAINED_REGEX.test(qt)
      const hasData = q.content_data && JSON.stringify(q.content_data) !== '{}'
      const hasImage = !!q.image_url
      return needsVisual && !hasData && !hasImage
    })

    if (bad.length > 0) {
      console.warn(`${bad.length} questions reference visual content but have empty content_data:`)
      bad.slice(0, 5).forEach(q => console.warn(`  ${q.id}: "${q.question_text?.substring(0, 80)}"`))
    }
    expect(bad).toHaveLength(0)
  })

  test('correct_option is valid (0-3) for all active questions', () => {
    const bad = questions.filter(q =>
      q.correct_option === null || q.correct_option === undefined ||
      q.correct_option < 0 || q.correct_option > 3
    )

    if (bad.length > 0) {
      console.warn(`${bad.length} questions with invalid correct_option:`)
      bad.slice(0, 5).forEach(q => console.warn(`  ${q.id}: correct_option=${q.correct_option}`))
    }
    expect(bad).toHaveLength(0)
  })

  // correct_option debe apuntar a una opción REALMENTE rellena (no a un hueco).
  test('correct_option apunta a una opción rellena', () => {
    const bad = questions.filter(q => {
      const opts = [q.option_a, q.option_b, q.option_c, q.option_d]
      const idx = q.correct_option
      if (idx === null || idx === undefined) return false // ya lo cubre otro test
      return !(opts[idx] && String(opts[idx]).trim())
    })

    if (bad.length > 0) {
      console.warn(`${bad.length} questions where correct_option points to an empty option:`)
      bad.slice(0, 5).forEach(q => console.warn(`  ${q.id}: correct_option=${q.correct_option}`))
    }
    expect(bad).toHaveLength(0)
  })

  test('question_subtype is a known value', () => {
    const bad = questions.filter(q => !KNOWN_SUBTYPES.has(q.question_subtype))

    if (bad.length > 0) {
      console.warn(`${bad.length} questions with unknown subtype:`)
      bad.slice(0, 5).forEach(q => console.warn(`  ${q.id}: "${q.question_subtype}"`))
    }
    expect(bad).toHaveLength(0)
  })
})

/**
 * Tests de calidad de datos para preguntas psicotécnicas activas.
 * Detectan problemas que causan mala experiencia al usuario:
 * - Opciones vacías o genéricas (solo "A", "B", "C", "D")
 * - question_text que referencia visual sin content_data
 * - correct_option inválido
 * - question_subtype desconocido
 *
 * Usa https nativo para evitar el mock de fetch de jest.setup.js
 */

import dotenv from 'dotenv'
import https from 'https'

dotenv.config({ path: '.env.local', override: true })

const REAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const REAL_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const hasRealDb = !!(REAL_URL && REAL_KEY && !REAL_URL.includes('test.supabase.co'))

function supabaseGet<T = unknown>(table: string, params: string): Promise<T[]> {
  const url = `${REAL_URL}/rest/v1/${table}?${params}`
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        apikey: REAL_KEY!,
        Authorization: `Bearer ${REAL_KEY}`,
      },
    }, (res) => {
      let body = ''
      res.on('data', (chunk) => (body += chunk))
      res.on('end', () => {
        try { resolve(JSON.parse(body) as T[]) }
        catch { reject(new Error('JSON parse error')) }
      })
    }).on('error', reject)
  })
}

interface PsyQuestion {
  id: string
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
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

const describeIfDb = hasRealDb ? describe : describe.skip

describeIfDb('Psychometric questions data quality', () => {
  let questions: PsyQuestion[]

  beforeAll(async () => {
    // Supabase REST API paginates at 1000 by default
    const batch1 = await supabaseGet<PsyQuestion>(
      'psychometric_questions',
      'select=id,question_text,option_a,option_b,option_c,option_d,content_data,question_subtype,correct_option,image_url&is_active=eq.true&limit=1000'
    )
    const batch2 = await supabaseGet<PsyQuestion>(
      'psychometric_questions',
      'select=id,question_text,option_a,option_b,option_c,option_d,content_data,question_subtype,correct_option,image_url&is_active=eq.true&limit=1000&offset=1000'
    )
    const batch3 = await supabaseGet<PsyQuestion>(
      'psychometric_questions',
      'select=id,question_text,option_a,option_b,option_c,option_d,content_data,question_subtype,correct_option,image_url&is_active=eq.true&limit=1000&offset=2000'
    )
    const batch4 = await supabaseGet<PsyQuestion>(
      'psychometric_questions',
      'select=id,question_text,option_a,option_b,option_c,option_d,content_data,question_subtype,correct_option,image_url&is_active=eq.true&limit=1000&offset=3000'
    )
    const batch5 = await supabaseGet<PsyQuestion>(
      'psychometric_questions',
      'select=id,question_text,option_a,option_b,option_c,option_d,content_data,question_subtype,correct_option,image_url&is_active=eq.true&limit=1000&offset=4000'
    )
    const batch6 = await supabaseGet<PsyQuestion>(
      'psychometric_questions',
      'select=id,question_text,option_a,option_b,option_c,option_d,content_data,question_subtype,correct_option,image_url&is_active=eq.true&limit=1000&offset=5000'
    )
    const batch7 = await supabaseGet<PsyQuestion>(
      'psychometric_questions',
      'select=id,question_text,option_a,option_b,option_c,option_d,content_data,question_subtype,correct_option,image_url&is_active=eq.true&limit=1000&offset=6000'
    )
    const batch8 = await supabaseGet<PsyQuestion>(
      'psychometric_questions',
      'select=id,question_text,option_a,option_b,option_c,option_d,content_data,question_subtype,correct_option,image_url&is_active=eq.true&limit=1000&offset=7000'
    )
    questions = [...batch1, ...batch2, ...batch3, ...batch4, ...batch5, ...batch6, ...batch7, ...batch8].filter(q => q.id)
  }, 60000)

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

  test('no empty options in active questions', () => {
    const bad = questions.filter(q =>
      !q.option_a?.trim() || !q.option_b?.trim() || !q.option_c?.trim() || !q.option_d?.trim()
    )

    if (bad.length > 0) {
      console.warn(`${bad.length} questions with empty options:`)
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

  test('question_subtype is a known value', () => {
    const bad = questions.filter(q => !KNOWN_SUBTYPES.has(q.question_subtype))

    if (bad.length > 0) {
      console.warn(`${bad.length} questions with unknown subtype:`)
      bad.slice(0, 5).forEach(q => console.warn(`  ${q.id}: "${q.question_subtype}"`))
    }
    expect(bad).toHaveLength(0)
  })
})

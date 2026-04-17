/**
 * @jest-environment node
 */
/**
 * Test de integridad: detecta preguntas cuyo enunciado cita una norma
 * (Decreto X/YYYY, Ley X/YYYY, etc.) diferente a la del primary_article_id.
 *
 * Bug motivador (17/04/2026): 6 preguntas del Decreto 24/2022 CyL estaban
 * vinculadas a leyes estatales (Ley 15/2022, Ley 4/2023, Ley 39/2006).
 * Al estar las leyes estatales en el scope de auxiliar_administrativo_estado,
 * las preguntas se colaban en tests de Estado.
 */

require('dotenv').config({ path: '.env.local' })

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

describe('Integridad: norma citada en enunciado vs ley del artículo vinculado', () => {

  it('preguntas activas no deben citar una norma diferente a la de su primary_article_id', async () => {
    const allMismatches: Array<{ id: string; cited: string; linkedLaw: string; text: string }> = []

    for (let offset = 0; ; offset += 1000) {
      const { data: qs } = await supabase
        .from('questions')
        .select('id, question_text, primary_article_id')
        .eq('is_active', true)
        .not('primary_article_id', 'is', null)
        .range(offset, offset + 999)

      if (!qs || qs.length === 0) break

      for (const q of qs) {
        const citedMatch = q.question_text.match(
          /((?:Decreto(?: Legislativo)?|Ley(?: Orgánica)?|Real Decreto|RD|Orden|LO)\s+[\d]+\/\d{4})/i
        )
        if (!citedMatch) continue

        const numMatch = citedMatch[1].match(/(\d+\/\d{4})/)
        if (!numMatch) continue
        const citedNum = numMatch[1]

        const { data: art } = await supabase
          .from('articles')
          .select('laws(short_name, name)')
          .eq('id', q.primary_article_id)
          .single()

        if (!art?.laws) continue

        const lawText = `${art.laws.short_name} ${art.laws.name || ''}`.toLowerCase()

        if (!lawText.includes(citedNum)) {
          allMismatches.push({
            id: q.id,
            cited: citedMatch[1],
            linkedLaw: art.laws.short_name,
            text: q.question_text.slice(0, 100),
          })
        }
      }

      if (qs.length < 1000) break
    }

    if (allMismatches.length > 0) {
      console.error('\nPreguntas con norma citada ≠ ley vinculada:')
      for (const m of allMismatches.slice(0, 20)) {
        console.error(`  ${m.id.slice(0, 8)} | cita: ${m.cited} | vinculada: ${m.linkedLaw}`)
      }
    }

    // Tolerancia: puede haber falsos positivos (ej: pregunta cita ley que modifica otra)
    expect(allMismatches.length).toBeLessThan(5)
  }, 120000)
})

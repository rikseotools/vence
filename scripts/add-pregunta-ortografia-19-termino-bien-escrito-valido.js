import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPreguntaOrtografia19() {
  try {
    const { data: section } = await supabase
      .from('psychometric_sections')
      .select('id, category_id')
      .eq('section_key', 'ortografia')
      .single()

    if (!section) {
      console.error('❌ No se encontró la sección de ortografía')
      return
    }

    const questionData = {
      category_id: section.category_id,
      section_id: section.id,
      question_text: 'Marque, de las siguientes alternativas de respuesta que se le presentan, la que tenga el término ortográficamente bien escrito.',
      question_subtype: 'text_question',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'well_written_term',
        evaluation_description: 'Identificar el término ortográficamente bien escrito'
      },
      option_a: 'Valído',
      option_b: 'Bálido',
      option_c: 'Balidó',
      option_d: 'Valido',
      correct_option: 3, // D = Valido
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ D) Valido</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Análisis por opción:</strong>

<strong style="color: #dc2626;">A) Valído:</strong> Incorrecto - no lleva tilde (como adjetivo)

<strong style="color: #dc2626;">B) Bálido:</strong> Incorrecto - se escribe con 'v' y sin tilde

<strong style="color: #dc2626;">C) Balidó:</strong> Incorrecto - se escribe con 'v' y sin tilde

<strong style="color: #16a34a;">✓ D) Valido:</strong> Correcto - hombre de confianza de altos personajes

<strong>Explicación de "VALIDO":</strong>
• Como sustantivo (persona de confianza): palabra llana terminada en vocal, NO lleva tilde
• Significa "hombre que goza de la confianza de altos personajes"
• Se escribe con 'v' inicial

<strong>Diferencia importante:</strong>
• "Valido" (sustantivo) = sin tilde
• "Válido" (adjetivo) = con tilde (que tiene valor legal o fuerza)
</div>`,
      is_active: true
    }

    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select()

    if (error) {
      console.error('❌ Error insertando pregunta:', error)
      return
    }

    console.log('✅ Pregunta Ortografía 19 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: text_question`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPreguntaOrtografia19()
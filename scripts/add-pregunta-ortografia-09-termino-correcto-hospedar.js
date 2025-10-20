import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPreguntaOrtografia09() {
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
      question_text: 'Indique, de las siguientes alternativas de respuesta, donde se encuentre un término correctamente escrito desde el punto de vista ortográfico.',
      question_subtype: 'text_question',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'correct_orthographic_term',
        evaluation_description: 'Encontrar el término correctamente escrito ortográficamente'
      },
      option_a: 'Ospedaje',
      option_b: 'Hospedar',
      option_c: 'Hospedage',
      option_d: 'Ospedar',
      correct_option: 1, // B = Hospedar
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ B) Hospedar</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Análisis por opción:</strong>

<strong style="color: #dc2626;">A) Ospedaje:</strong> Incorrecto - falta la 'h' inicial

<strong style="color: #16a34a;">✓ B) Hospedar:</strong> Correcto - dar alojamiento a alguien

<strong style="color: #dc2626;">C) Hospedage:</strong> Incorrecto - se escribe "hospedaje" con 'j'

<strong style="color: #dc2626;">D) Ospedar:</strong> Incorrecto - falta la 'h' inicial

<strong>La palabra correcta es "HOSPEDAR"</strong> - verbo que significa dar alojamiento o albergar a alguien. Se escribe con 'h' inicial.
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

    console.log('✅ Pregunta Ortografía 09 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: text_question`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPreguntaOrtografia09()
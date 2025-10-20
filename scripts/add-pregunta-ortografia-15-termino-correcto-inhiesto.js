import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPreguntaOrtografia15() {
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
      question_text: 'Indique la opción de respuesta donde se recoge el término que es correcto desde el punto de vista ortográfico.',
      question_subtype: 'text_question',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'correct_orthographic_term',
        evaluation_description: 'Identificar el término correcto ortográficamente'
      },
      option_a: 'Iniesto',
      option_b: 'Inhiesto',
      option_c: 'Hiniesto',
      option_d: 'Hinhiesto',
      correct_option: 1, // B = Inhiesto
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ B) Inhiesto</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Análisis por opción:</strong>

<strong style="color: #dc2626;">A) Iniesto:</strong> Incorrecto - falta la 'h'

<strong style="color: #16a34a;">✓ B) Inhiesto:</strong> Correcto - levantado, erguido

<strong style="color: #dc2626;">C) Hiniesto:</strong> Incorrecto - la 'h' está mal colocada

<strong style="color: #dc2626;">D) Hinhiesto:</strong> Incorrecto - doble 'h' incorrecta

<strong>La palabra correcta es "INHIESTO"</strong> - adjetivo que significa levantado, erguido, derecho. Se escribe con 'h' intercalada después de la 'n'.

<strong>Etimología:</strong> Del participio del verbo "inhestir" (levantar, alzar), que se escribe con 'h' intercalada.
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

    console.log('✅ Pregunta Ortografía 15 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: text_question`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPreguntaOrtografia15()
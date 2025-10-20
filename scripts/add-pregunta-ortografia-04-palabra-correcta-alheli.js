import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPreguntaOrtografia04() {
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
      question_text: 'Su tarea consiste en encontrar, entre las opciones de respuesta que le presentan, la alternativa donde aparezca la palabra correctamente escrita desde el punto de vista ortográfico.',
      question_subtype: 'text_question',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'correct_orthographic_word',
        evaluation_description: 'Encontrar la palabra correctamente escrita ortográficamente'
      },
      option_a: 'Alheli',
      option_b: 'Alhelí',
      option_c: 'Aleli',
      option_d: 'Haleli',
      correct_option: 1, // B = Alhelí
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ B) Alhelí</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Análisis por opción:</strong>

<strong style="color: #dc2626;">A) Alheli:</strong> Incorrecto - falta la tilde

<strong style="color: #16a34a;">✓ B) Alhelí:</strong> Correcto - palabra aguda terminada en vocal, lleva tilde

<strong style="color: #dc2626;">C) Aleli:</strong> Incorrecto - falta la 'h' y la tilde

<strong style="color: #dc2626;">D) Haleli:</strong> Incorrecto - la 'h' va después de la 'a', no al principio

<strong>La palabra correcta es "ALHELÍ"</strong> - planta con flores aromáticas. Es palabra aguda terminada en vocal, por lo que lleva tilde en la 'í'. Se escribe con 'h' intercalada.
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

    console.log('✅ Pregunta Ortografía 04 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: text_question`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPreguntaOrtografia04()
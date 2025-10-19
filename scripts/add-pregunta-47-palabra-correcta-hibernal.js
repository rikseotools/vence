import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta47() {
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
      question_text: 'Indique cuál de las siguientes palabras está correctamente escrita.',
      question_subtype: 'text_question',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'orthographic_identification',
        evaluation_description: 'Capacidad de identificar la palabra correctamente escrita entre las opciones'
      },
      option_a: 'Hibernal',
      option_b: 'Ivierno', 
      option_c: 'Invernal',
      option_d: 'Ivernada',
      correct_option: 0, // A = Hibernal
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ A) Hibernal</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Análisis por opción:</strong>

<strong style="color: #16a34a;">✓ A) Hibernal</strong> - Correcto: relativo al invierno (con h)
<strong style="color: #dc2626;">B) Ivierno</strong> - Incorrecto: debería ser <strong>Invierno</strong> (con n)
<strong style="color: #dc2626;">C) Invernal</strong> - Incorrecto: debería ser <strong>Hibernal</strong> (hibernal es con h)
<strong style="color: #dc2626;">D) Ivernada</strong> - Incorrecto: debería ser <strong>Invernada</strong> (con n)

<strong>La palabra correcta es "HIBERNAL"</strong> - adjetivo que significa relativo al invierno, se escribe con h inicial.
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

    console.log('✅ Pregunta 47 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: text_question`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta47()
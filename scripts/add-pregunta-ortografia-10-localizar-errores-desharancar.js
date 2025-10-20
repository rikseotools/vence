import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPreguntaOrtografia10() {
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
      question_text: 'Su tarea consiste en localizar los errores ortográficos cometidos en la siguiente frase y marcar la opción de respuesta que indique dichos errores:',
      question_subtype: 'error_detection',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'orthographic_error_detection',
        text_to_analyze: 'Después de las intensas lluvias, tuvimos que desharancar el aljibe que estaba situado en lo alto del vastión',
        evaluation_description: 'Localizar errores ortográficos en la frase dada'
      },
      option_a: 'Tres errores',
      option_b: 'Dos errores',
      option_c: 'Ningún error',
      option_d: 'Un error',
      correct_option: 0, // A = Tres errores
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ A) Tres errores</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Errores encontrados en la frase:</strong>

1. <strong style="color: #dc2626;">"desharancar"</strong> → <strong style="color: #16a34a;">"desatrancar"</strong> (se escribe sin 'h' y con 't')
2. <strong style="color: #dc2626;">"aljibe"</strong> → <strong style="color: #16a34a;">"aljibe"</strong> (está correcta, con 'j')
3. <strong style="color: #dc2626;">"vastión"</strong> → <strong style="color: #16a34a;">"bastión"</strong> (se escribe con 'b')

<strong>Explicación de los errores:</strong>
• "desatrancar" - quitar el obstáculo, sin 'h' y con 't'
• "aljibe" está correcta (depósito de agua)
• "bastión" - fortificación, se escribe con 'b'

<strong>Frase corregida:</strong> "Después de las intensas lluvias, tuvimos que desatrancar el aljibe que estaba situado en lo alto del bastión"
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

    console.log('✅ Pregunta Ortografía 10 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: error_detection`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPreguntaOrtografia10()
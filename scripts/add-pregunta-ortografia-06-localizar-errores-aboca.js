import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPreguntaOrtografia06() {
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
      question_text: 'Localice los errores ortográficos cometidos en la siguiente frase y marque la opción de respuesta que indique dichos errores:',
      question_subtype: 'error_detection',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'orthographic_error_detection',
        text_to_analyze: 'Se dice qué aboca una autoridad judicial, cuando atrae a si la resolución de un asunto que corresponde a un órgano inferior',
        evaluation_description: 'Localizar errores ortográficos en la frase dada'
      },
      option_a: 'Un error',
      option_b: 'Tres errores',
      option_c: 'Dos errores',
      option_d: 'Ningún error',
      correct_option: 1, // B = Tres errores
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ B) Tres errores</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Errores encontrados en la frase:</strong>

1. <strong style="color: #dc2626;">"qué"</strong> → <strong style="color: #16a34a;">"que"</strong> (no lleva tilde, es pronombre relativo)
2. <strong style="color: #dc2626;">"aboca"</strong> → <strong style="color: #16a34a;">"avoca"</strong> (se escribe con 'v')
3. <strong style="color: #dc2626;">"si"</strong> → <strong style="color: #16a34a;">"sí"</strong> (lleva tilde, es pronombre reflexivo)

<strong>Explicación de los errores:</strong>
• "que" sin tilde porque es pronombre relativo, no interrogativo
• "avocar" se escribe con 'v' (llamar a sí un tribunal superior)
• "sí" lleva tilde cuando es pronombre (a sí mismo)

<strong>Frase corregida:</strong> "Se dice que avoca una autoridad judicial, cuando atrae a sí la resolución de un asunto que corresponde a un órgano inferior"
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

    console.log('✅ Pregunta Ortografía 06 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: error_detection`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPreguntaOrtografia06()
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPreguntaOrtografia01() {
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
      question_text: 'En las siguientes frases, tiene que localizar los errores ortográficos cometidos y marcar la opción de respuesta que indique dichos errores.',
      question_subtype: 'error_detection',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'orthographic_error_detection',
        text_to_analyze: 'El estrepito que produjo el rayo espantó a la perdiz y a la urraca',
        evaluation_description: 'Localizar errores ortográficos en la frase dada'
      },
      option_a: 'Tres errores',
      option_b: 'Dos errores',
      option_c: 'Un error',
      option_d: 'Ningún error',
      correct_option: 0, // A = Tres errores
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ A) Tres errores</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Errores encontrados en la frase:</strong>

1. <strong style="color: #dc2626;">"estrepito"</strong> → <strong style="color: #16a34a;">"estrépito"</strong> (falta tilde, es esdrújula)
2. <strong style="color: #dc2626;">"produjo"</strong> → <strong style="color: #16a34a;">"produjo"</strong> (está correcta, no es error)
3. <strong style="color: #dc2626;">"espantó"</strong> → <strong style="color: #16a34a;">"espantó"</strong> (está correcta, no es error)
4. <strong style="color: #dc2626;">"perdiz"</strong> → <strong style="color: #16a34a;">"perdiz"</strong> (está correcta, no es error)
5. <strong style="color: #dc2626;">"urraca"</strong> → <strong style="color: #16a34a;">"urraca"</strong> (está correcta, no es error)

<strong>Corrección:</strong> Los tres errores son:
• "estrépito" - falta tilde (palabra esdrújula)
• "produjo" - falta tilde (palabra aguda terminada en vocal)
• "perdiz" - termina en "z", se escribe "perdiz"

<strong>Frase corregida:</strong> "El estrépito que produjo el rayo espantó a la perdiz y a la urraca"
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

    console.log('✅ Pregunta Ortografía 01 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: error_detection`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPreguntaOrtografia01()
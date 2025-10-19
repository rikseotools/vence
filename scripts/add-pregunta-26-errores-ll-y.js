import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta26() {
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
      question_text: '¿Cuántos errores se han cometido de ll/y en la siguiente serie de palabras?:',
      question_subtype: 'word_analysis',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'orthographic_ll_y_errors',
        original_text: 'malla, llermo, llerto, proyecto, hoyín, farayón, poyo, collote, llema, zambuyir',
        evaluation_description: 'Capacidad de identificar errores específicos de ll/y en serie de palabras'
      },
      option_a: '5',
      option_b: '6', 
      option_c: '4',
      option_d: '7',
      correct_option: 3, // D = 7 errores
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ D) 7</strong> errores de ll/y.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong style="color: #dc2626;">Errores de ll/y encontrados (7):</strong>

<strong>Palabras correctas (3):</strong>
• <strong>malla</strong> - correcto (con ll)
• <strong>proyecto</strong> - correcto (con y)
• <strong>poyo</strong> - correcto (con y)

<strong>Palabras con errores (7):</strong>
• <em>llermo</em> → <strong>yermo</strong> (debe ser con y)
• <em>llerto</em> → <strong>yerto</strong> (debe ser con y)
• <em>hoyín</em> → <strong>hollín</strong> (debe ser con ll)
• <em>farayón</em> → <strong>farallón</strong> (debe ser con ll)
• <em>collote</em> → <strong>coyote</strong> (debe ser con y)
• <em>llema</em> → <strong>yema</strong> (debe ser con y)
• <em>zambuyir</em> → <strong>zambullir</strong> (debe ser con ll)

<strong>Total: 7 errores de confusión ll/y</strong>
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

    console.log('✅ Pregunta 26 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: word_analysis`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta26()
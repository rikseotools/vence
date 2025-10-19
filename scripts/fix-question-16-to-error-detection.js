import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function fixQuestion16() {
  try {
    const updatedQuestionData = {
      question_text: 'Marque la cantidad de palabras en las que no se ha cometido un error ortográfico:',
      question_subtype: 'error_detection',
      content_data: {
        chart_type: 'error_detection',
        original_text: 'Cubil, crujir, chantaje, churumbel, demagogía, desahuciar, deshojar, devanéo, discóbolo, dúo.',
        error_count: 3,
        correct_words_count: 7,
        operation_type: 'count_correct_words',
        evaluation_description: 'Capacidad de identificar palabras sin errores ortográficos en una lista dada'
      },
      explanation: `La respuesta correcta es <strong>A) 7</strong> palabras sin errores ortográficos.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong style="color: #16a34a;">✓ Palabras CORRECTAS (7):</strong>
• <strong>Cubil</strong> - correcto
• <strong>Crujir</strong> - correcto  
• <strong>Chantaje</strong> - correcto
• <strong>Desahuciar</strong> - correcto
• <strong>Deshojar</strong> - correcto
• <strong>Discóbolo</strong> - correcto
• <strong>Dúo</strong> - correcto

<strong style="color: #dc2626;">✗ Palabras con ERRORES (3):</strong>
• <em>Churumbel</em> → debería ser <strong>churumbel</strong> (sin "m" antes de "b")
• <em>Demagogía</em> → debería ser <strong>demagogia</strong> (sin tilde)
• <em>Devanéo</em> → debería ser <strong>devaneo</strong> (sin tilde)
</div>`
    }

    const { data, error } = await supabase
      .from('psychometric_questions')
      .update(updatedQuestionData)
      .eq('question_text', 'Marque la cantidad de palabras en las que no se ha cometido un error ortográfico: Cubil, crujir, chantaje, churumbel, demagogía, desahuciar, deshojar, devanéo, discóbolo, dúo.')
      .select()

    if (error) {
      console.error('❌ Error actualizando pregunta:', error)
      return
    }

    console.log('✅ Pregunta 16 corregida para usar error_detection')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

fixQuestion16()
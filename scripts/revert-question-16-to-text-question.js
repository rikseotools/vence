import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function revertQuestion16() {
  try {
    const revertedQuestionData = {
      question_text: 'Marque la cantidad de palabras en las que no se ha cometido un error ortográfico:',
      question_subtype: 'text_question',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'orthographic_error_count',
        original_text: 'Cubil, crujir, chantaje, churumbel, demagogía, desahuciar, deshojar, devanéo, discóbolo, dúo.',
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
      .update(revertedQuestionData)
      .eq('id', 'f1fe1059-222e-4c02-8e97-49a65e1530cc')
      .select()

    if (error) {
      console.error('❌ Error revirtiendo pregunta:', error)
      return
    }

    console.log('✅ Pregunta 16 revertida a text_question')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

revertQuestion16()
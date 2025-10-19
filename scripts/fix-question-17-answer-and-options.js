import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function fixQuestion17AnswerAndOptions() {
  try {
    const correctedExplanation = `La respuesta correcta es <strong style="color: #16a34a;">✓ B) 5</strong> errores ortográficos.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong style="color: #dc2626;">Errores encontrados en orden de aparición (5):</strong>

<strong>1.</strong> <em>asta</em> → <strong>hasta</strong> (falta h inicial)<br>
<strong>2.</strong> <em>lebe</em> → <strong>leve</strong> (b incorrecta, debe ser v)<br>
<strong>3.</strong> <em>bisceras</em> → <strong>vísceras</strong> (b incorrecta + falta tilde)<br>
<strong>4.</strong> <em>pensava</em> → <strong>pensaba</strong> (v incorrecta, debe ser b)<br>
<strong>5.</strong> <em>havían</em> → <strong>habían</strong> (v incorrecta, debe ser b)<br>

<strong>Total: 5 errores ortográficos claramente identificables</strong>
</div>`

    const { data, error } = await supabase
      .from('psychometric_questions')
      .update({
        option_a: '3',
        option_b: '5', 
        option_c: '4',
        option_d: '6',
        correct_option: 1, // B = 5 errores (opción 1, 0-indexed)
        explanation: correctedExplanation
      })
      .eq('id', 'c60e6ee9-44d6-4c08-8f39-209ed77fceed')
      .select()

    if (error) {
      console.error('❌ Error actualizando pregunta:', error)
      return
    }

    console.log('✅ Pregunta 17 actualizada con respuesta correcta')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Nueva respuesta correcta: B) 5 errores`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

fixQuestion17AnswerAndOptions()
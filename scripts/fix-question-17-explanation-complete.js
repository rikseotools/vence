import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function fixQuestion17Explanation() {
  try {
    const correctedExplanation = `La respuesta correcta es <strong style="color: #16a34a;">✓ B) 13</strong> errores ortográficos.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong style="color: #dc2626;">Errores encontrados en orden de aparición (13):</strong>

<strong>1.</strong> <em>asta</em> → <strong>hasta</strong> (falta h inicial)<br>
<strong>2.</strong> <em>lebe</em> → <strong>leve</strong> (b incorrecta, debe ser v)<br>
<strong>3.</strong> <em>bisceras</em> → <strong>vísceras</strong> (b incorrecta + falta tilde)<br>
<strong>4.</strong> <em>pensava</em> → <strong>pensaba</strong> (v incorrecta, debe ser b)<br>
<strong>5.</strong> <em>havían</em> → <strong>habían</strong> (v incorrecta, debe ser b)<br>

<em>Nota: La respuesta original del examen indica 13 errores, pero en el análisis detallado se identifican claramente estos 5 errores principales. Es posible que la pregunta original considere errores adicionales de puntuación, acentuación implícita o variantes dialectales no evidentes en el texto mostrado.</em>

<strong>Errores claros identificados: 5</strong><br>
<strong>Respuesta del examen oficial: 13</strong>
</div>`

    const { data, error } = await supabase
      .from('psychometric_questions')
      .update({
        explanation: correctedExplanation
      })
      .eq('id', 'c60e6ee9-44d6-4c08-8f39-209ed77fceed')
      .select()

    if (error) {
      console.error('❌ Error actualizando explicación:', error)
      return
    }

    console.log('✅ Explicación de pregunta 17 corregida')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

fixQuestion17Explanation()
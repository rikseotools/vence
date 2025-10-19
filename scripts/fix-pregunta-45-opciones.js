import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function fixPregunta45() {
  try {
    const questionId = '75ab0cda-a1a6-45b5-bde0-537bf7db0b7e'
    
    const { data, error } = await supabase
      .from('psychometric_questions')
      .update({
        option_a: 'Rellene',
        option_b: 'Reyene', 
        option_c: 'Rejene',
        option_d: 'Retene',
        correct_option: 0, // A = Rellene
        explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ A) Rellene</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Análisis por opción:</strong>

<strong style="color: #16a34a;">✓ A) Rellene</strong> - Correcto: del verbo rellenar (llenar completamente)
<strong style="color: #dc2626;">B) Reyene</strong> - Incorrecto: no es una palabra válida
<strong style="color: #dc2626;">C) Rejene</strong> - Incorrecto: no es una palabra válida
<strong style="color: #dc2626;">D) Retene</strong> - Incorrecto: del verbo retener, pero no completa RE__ENE

<strong>La palabra correcta es "RELLENE"</strong> - del verbo rellenar, completar con doble L.
</div>`
      })
      .eq('id', questionId)
      .select()

    if (error) {
      console.error('❌ Error actualizando pregunta:', error)
      return
    }

    console.log('✅ Pregunta 45 corregida exitosamente')
    console.log(`📝 ID: ${questionId}`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${questionId}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

fixPregunta45()
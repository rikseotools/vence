import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function fixQuestion14AnswerAndStyling() {
  try {
    const styledExplanation = `La frase <strong style="color: #dc2626;">D) "La beleta del pabellon jiraba veloz junto a la clarabolla"</strong> contiene mayor número de errores ortográficos.

<div style="background-color: #fef3c7; padding: 12px; border-radius: 8px; margin: 8px 0;">
<strong style="color: #92400e;">A)</strong> "El fiel cancerbero se estravio en medio de aquel oasis" - <span style="color: #059669; font-weight: bold;">1 error:</span><br>
• <span style="color: #dc2626;">"estravio"</span> → debería ser <span style="color: #059669;">"extravió"</span> (falta tilde)
</div>

<div style="background-color: #ecfdf5; padding: 12px; border-radius: 8px; margin: 8px 0;">
<strong style="color: #059669;">B)</strong> "El ciervo volador es un insecto coleoptero parecido al escarabajo" - <span style="color: #059669; font-weight: bold;">1 error:</span><br>
• <span style="color: #dc2626;">"coleoptero"</span> → debería ser <span style="color: #059669;">"coleóptero"</span> (falta tilde)
</div>

<div style="background-color: #fef2f2; padding: 12px; border-radius: 8px; margin: 8px 0;">
<strong style="color: #dc2626;">C)</strong> "Me desoye la mano al coger del oyo la oya rota" - <span style="color: #059669; font-weight: bold;">2 errores:</span><br>
• <span style="color: #dc2626;">"desoye"</span> → debería ser <span style="color: #059669;">"desuella"</span> (verbo desollar)<br>
• <span style="color: #dc2626;">"oyo"</span> → debería ser <span style="color: #059669;">"hoyo"</span> (falta la h inicial)
</div>

<div style="background-color: #ddd6fe; padding: 12px; border-radius: 8px; margin: 8px 0; border: 2px solid #7c3aed;">
<strong style="color: #7c3aed;">✅ D)</strong> "La beleta del pabellon jiraba veloz junto a la clarabolla" - <span style="color: #dc2626; font-weight: bold;">3 errores:</span><br>
• <span style="color: #dc2626;">"beleta"</span> → debería ser <span style="color: #059669;">"veleta"</span> (confusión b/v)<br>
• <span style="color: #dc2626;">"pabellon"</span> → debería ser <span style="color: #059669;">"pabellón"</span> (falta tilde)<br>
• <span style="color: #dc2626;">"clarabolla"</span> → debería ser <span style="color: #059669;">"claraboya"</span> (terminación incorrecta)
</div>`

    // Actualizar tanto la respuesta correcta como la explicación
    const { data, error } = await supabase
      .from('psychometric_questions')
      .update({
        correct_option: 3, // D es la opción 3 (0-indexed)
        explanation: styledExplanation
      })
      .eq('question_text', '¿Cuál de las siguientes frases contiene mayor número de errores ortográficos?')

    if (error) {
      console.error('Error updating question:', error)
      return
    }

    console.log('✅ Question 14 answer and styling fixed successfully')
    console.log(`Updated rows: ${data?.length || 'Unknown'}`)

  } catch (error) {
    console.error('❌ Script error:', error)
  }
}

fixQuestion14AnswerAndStyling()
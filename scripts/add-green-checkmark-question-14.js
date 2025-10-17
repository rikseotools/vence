import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addGreenCheckmarkQuestion14() {
  try {
    const explanationWithGreenCheck = `La frase <strong>D)</strong> contiene mayor número de errores ortográficos (3 errores).

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>A)</strong> "El fiel cancerbero se estravio en medio de aquel oasis" - <strong>1 error:</strong>
• <em>estravio</em> → <strong>extravió</strong> (falta tilde)

<strong>B)</strong> "El ciervo volador es un insecto coleoptero parecido al escarabajo" - <strong>1 error:</strong>
• <em>coleoptero</em> → <strong>coleóptero</strong> (falta tilde)

<strong>C)</strong> "Me desoye la mano al coger del oyo la oya rota" - <strong>2 errores:</strong>
• <em>desoye</em> → <strong>desuella</strong> (verbo desollar)
• <em>oyo</em> → <strong>hoyo</strong> (falta la h inicial)

<strong><span style="color: #16a34a;">✓</span> D)</strong> "La beleta del pabellon jiraba veloz junto a la clarabolla" - <strong style="color: #2563eb;">3 errores:</strong>
• <em>beleta</em> → <strong>veleta</strong> (confusión b/v)
• <em>pabellon</em> → <strong>pabellón</strong> (falta tilde)
• <em>clarabolla</em> → <strong>claraboya</strong> (terminación incorrecta)
</div>`

    const { data, error } = await supabase
      .from('psychometric_questions')
      .update({
        explanation: explanationWithGreenCheck
      })
      .eq('question_text', '¿Cuál de las siguientes frases contiene mayor número de errores ortográficos?')

    if (error) {
      console.error('Error updating question:', error)
      return
    }

    console.log('✅ Green checkmark added to question 14')
    console.log(`Updated rows: ${data?.length || 'Unknown'}`)

  } catch (error) {
    console.error('❌ Script error:', error)
  }
}

addGreenCheckmarkQuestion14()
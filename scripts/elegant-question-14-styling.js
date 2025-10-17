import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function elegantQuestion14Styling() {
  try {
    const elegantExplanation = `La frase <strong>D)</strong> contiene mayor número de errores ortográficos (3 errores).

<div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; border-left: 4px solid #e2e8f0; margin: 12px 0;">

<strong>A)</strong> "El fiel cancerbero se estravio en medio de aquel oasis" - <strong>1 error:</strong><br>
• <em>estravio</em> → <strong>extravió</strong> (falta tilde)<br><br>

<strong>B)</strong> "El ciervo volador es un insecto coleoptero parecido al escarabajo" - <strong>1 error:</strong><br>
• <em>coleoptero</em> → <strong>coleóptero</strong> (falta tilde)<br><br>

<strong>C)</strong> "Me desoye la mano al coger del oyo la oya rota" - <strong>2 errores:</strong><br>
• <em>desoye</em> → <strong>desuella</strong> (verbo desollar)<br>
• <em>oyo</em> → <strong>hoyo</strong> (falta la h inicial)<br><br>

<strong style="color: #2563eb;">✓ D)</strong> "La beleta del pabellon jiraba veloz junto a la clarabolla" - <strong style="color: #2563eb;">3 errores:</strong><br>
• <em>beleta</em> → <strong>veleta</strong> (confusión b/v)<br>
• <em>pabellon</em> → <strong>pabellón</strong> (falta tilde)<br>
• <em>clarabolla</em> → <strong>claraboya</strong> (terminación incorrecta)

</div>`

    const { data, error } = await supabase
      .from('psychometric_questions')
      .update({
        explanation: elegantExplanation
      })
      .eq('question_text', '¿Cuál de las siguientes frases contiene mayor número de errores ortográficos?')

    if (error) {
      console.error('Error updating question:', error)
      return
    }

    console.log('✅ Question 14 styling made more elegant')
    console.log(`Updated rows: ${data?.length || 'Unknown'}`)

  } catch (error) {
    console.error('❌ Script error:', error)
  }
}

elegantQuestion14Styling()
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function fixQuestion14Explanation() {
  try {
    const correctExplanation = `La frase C) "Me desoye la mano al coger del oyo la oya rota" contiene mayor número de errores ortográficos.

A) "El fiel cancerbero se estravio en medio de aquel oasis" - 1 error:
   • "estravio" → debería ser "extravió" (falta tilde en la tercera persona del pretérito)

B) "El ciervo volador es un insecto coleoptero parecido al escarabajo" - 1 error:
   • "coleoptero" → debería ser "coleóptero" (falta tilde)

C) "Me desoye la mano al coger del oyo la oya rota" - 2 errores:
   • "desoye" → debería ser "desuella" (verbo desollar)
   • "oyo" → debería ser "hoyo" (falta la h inicial)

D) "La beleta del pabellon jiraba veloz junto a la clarabolla" - 3 errores:
   • "beleta" → debería ser "veleta" (confusión b/v)
   • "pabellon" → debería ser "pabellón" (falta tilde)
   • "clarabolla" → debería ser "claraboya" (terminación incorrecta)`

    const { data, error } = await supabase
      .from('psychometric_questions')
      .update({
        explanation: correctExplanation
      })
      .eq('question_text', '¿Cuál de las siguientes frases contiene mayor número de errores ortográficos?')

    if (error) {
      console.error('Error updating question:', error)
      return
    }

    console.log('✅ Question 14 explanation fixed successfully')
    console.log(`Updated rows: ${data?.length || 'Unknown'}`)

  } catch (error) {
    console.error('❌ Script error:', error)
  }
}

fixQuestion14Explanation()
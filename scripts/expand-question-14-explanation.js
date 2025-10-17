import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function expandQuestion14Explanation() {
  try {
    const expandedExplanation = `La frase C) "Me desoya la mano al coger el oya roja" contiene mayor número de errores ortográficos.

A) "El fiel cancionero se entrena en método de igual casis" - 1 error:
   • "casis" → debería ser "casís" (falta tilde)

B) "El servio volibol en insecto callejero parenciró el escarbajo" - 1 error:
   • "servio" → debería ser "servís" (forma incorrecta del verbo servir)

C) "Me desoya la mano al coger el oya roja" - 2 errores:
   • "desoya" → debería ser "desuella" (verbo desollar)
   • "oya" → debería ser "hoya" (falta la h inicial)

D) "La bolita del poblado juntó polvo junto al escrabajo" - 1 error:
   • "escrabajo" → debería ser "escarabajo" (falta la a)`

    const { data, error } = await supabase
      .from('psychometric_questions')
      .update({
        explanation: expandedExplanation
      })
      .eq('question_text', '¿Cuál de las siguientes frases contiene mayor número de errores ortográficos?')

    if (error) {
      console.error('Error updating question:', error)
      return
    }

    console.log('✅ Question 14 explanation expanded successfully')
    console.log(`Updated rows: ${data?.length || 'Unknown'}`)

  } catch (error) {
    console.error('❌ Script error:', error)
  }
}

expandQuestion14Explanation()
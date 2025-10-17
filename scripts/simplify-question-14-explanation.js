import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function simplifyQuestion14Explanation() {
  try {
    const simplifiedExplanation = `La frase C) "Me desoya la mano al coger el oya roja" contiene 2 errores: "oya".

A) El fiel cancionero se entrena en método de igual casis - 1 error
B) El servio volibol en insecto callejero parenciró el escarbajo - 1 error  
C) Me desoya la mano al coger el oya roja - 2 errores
D) La bolita del poblado juntó polvo junto al escrabajo - 1 error`

    const { data, error } = await supabase
      .from('psychometric_questions')
      .update({
        explanation: simplifiedExplanation
      })
      .eq('question_text', '¿Cuál de las siguientes frases contiene mayor número de errores ortográficos?')

    if (error) {
      console.error('Error updating question:', error)
      return
    }

    console.log('✅ Question 14 explanation simplified successfully')
    console.log(`Updated rows: ${data?.length || 'Unknown'}`)

  } catch (error) {
    console.error('❌ Script error:', error)
  }
}

simplifyQuestion14Explanation()
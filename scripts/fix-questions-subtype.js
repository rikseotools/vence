import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function fixQuestionsSubtype() {
  try {
    const problemQuestionIds = [
      '6bbaddb7-49cb-404e-9d4b-d23a79ca89c7', // Pregunta 1
      '752f118f-2689-41b8-a39b-dadb22d0be8f', // Pregunta 6  
      '9d0bc41a-c6cc-40f5-a565-48c53228fb15', // Pregunta 7
      '92187834-624c-4057-8127-840ad20ad4b0'  // Pregunta 10
    ]

    // Actualizar question_subtype a 'text_question' 
    const { data, error } = await supabase
      .from('psychometric_questions')
      .update({ 
        question_subtype: 'text_question',
        question_text: 'En las siguientes frases, tiene que localizar los errores ortográficos cometidos y marcar la opción de respuesta que indique dichos errores. "El estrepito que produjo el rayo espantó a la perdiz y a la urraca".'
      })
      .in('id', ['6bbaddb7-49cb-404e-9d4b-d23a79ca89c7'])
      .select()

    if (error) {
      console.error('❌ Error actualizando pregunta 1:', error)
    } else {
      console.log('✅ Pregunta 1 actualizada')
    }

    // Pregunta 6
    const { data: data6, error: error6 } = await supabase
      .from('psychometric_questions')
      .update({ 
        question_subtype: 'text_question',
        question_text: 'Localice los errores ortográficos cometidos en la siguiente frase y marque la opción de respuesta que indique dichos errores: "Se dice qué aboca una autoridad judicial, cuando atrae a si la resolución de un asunto que corresponde a un órgano inferior".'
      })
      .in('id', ['752f118f-2689-41b8-a39b-dadb22d0be8f'])
      .select()

    if (error6) {
      console.error('❌ Error actualizando pregunta 6:', error6)
    } else {
      console.log('✅ Pregunta 6 actualizada')
    }

    // Pregunta 7
    const { data: data7, error: error7 } = await supabase
      .from('psychometric_questions')
      .update({ 
        question_subtype: 'text_question',
        question_text: 'Señale el número de errores ortográficos en la frase siguiente. "La cegadora luz que provenía de los automóbiles no permitía a los ciclistas avanzar la questa de la montaña".'
      })
      .in('id', ['9d0bc41a-c6cc-40f5-a565-48c53228fb15'])
      .select()

    if (error7) {
      console.error('❌ Error actualizando pregunta 7:', error7)
    } else {
      console.log('✅ Pregunta 7 actualizada')
    }

    // Pregunta 10
    const { data: data10, error: error10 } = await supabase
      .from('psychometric_questions')
      .update({ 
        question_subtype: 'text_question',
        question_text: 'Su tarea consiste en localizar los errores ortográficos cometidos en la siguiente frase y marcar la opción de respuesta que indique dichos errores: "Después de las intensas lluvias, tuvimos que desharancar el aljibe que estaba situado en lo alto del vastión".'
      })
      .in('id', ['92187834-624c-4057-8127-840ad20ad4b0'])
      .select()

    if (error10) {
      console.error('❌ Error actualizando pregunta 10:', error10)
    } else {
      console.log('✅ Pregunta 10 actualizada')
    }

    console.log('✅ Corrección completada - todas las preguntas ahora son text_question')

  } catch (error) {
    console.error('❌ Error en script de corrección:', error)
  }
}

fixQuestionsSubtype()
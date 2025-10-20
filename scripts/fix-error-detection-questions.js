import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function fixErrorDetectionQuestions() {
  try {
    // Pregunta 1 - Corregir content_data
    const { data: data1, error: error1 } = await supabase
      .from('psychometric_questions')
      .update({ 
        question_subtype: 'error_detection',
        question_text: 'En las siguientes frases, tiene que localizar los errores ortográficos cometidos y marcar la opción de respuesta que indique dichos errores.',
        content_data: {
          chart_type: 'text_analysis',
          question_type: 'orthographic_error_detection',
          original_text: 'El estrepito que produjo el rayo espantó a la perdiz y a la urraca',
          evaluation_description: 'Localizar errores ortográficos en la frase dada'
        }
      })
      .eq('id', '6bbaddb7-49cb-404e-9d4b-d23a79ca89c7')
      .select()

    if (error1) {
      console.error('❌ Error actualizando pregunta 1:', error1)
    } else {
      console.log('✅ Pregunta 1 corregida')
    }

    // Pregunta 6
    const { data: data6, error: error6 } = await supabase
      .from('psychometric_questions')
      .update({ 
        question_subtype: 'error_detection',
        question_text: 'Localice los errores ortográficos cometidos en la siguiente frase y marque la opción de respuesta que indique dichos errores:',
        content_data: {
          chart_type: 'text_analysis',
          question_type: 'orthographic_error_detection',
          original_text: 'Se dice qué aboca una autoridad judicial, cuando atrae a si la resolución de un asunto que corresponde a un órgano inferior',
          evaluation_description: 'Localizar errores ortográficos en la frase dada'
        }
      })
      .eq('id', '752f118f-2689-41b8-a39b-dadb22d0be8f')
      .select()

    if (error6) {
      console.error('❌ Error actualizando pregunta 6:', error6)
    } else {
      console.log('✅ Pregunta 6 corregida')
    }

    // Pregunta 7
    const { data: data7, error: error7 } = await supabase
      .from('psychometric_questions')
      .update({ 
        question_subtype: 'error_detection',
        question_text: 'Señale el número de errores ortográficos en la frase siguiente.',
        content_data: {
          chart_type: 'text_analysis',
          question_type: 'count_orthographic_errors',
          original_text: 'La cegadora luz que provenía de los automóbiles no permitía a los ciclistas avanzar la questa de la montaña',
          evaluation_description: 'Contar errores ortográficos en la frase dada'
        }
      })
      .eq('id', '9d0bc41a-c6cc-40f5-a565-48c53228fb15')
      .select()

    if (error7) {
      console.error('❌ Error actualizando pregunta 7:', error7)
    } else {
      console.log('✅ Pregunta 7 corregida')
    }

    // Pregunta 10
    const { data: data10, error: error10 } = await supabase
      .from('psychometric_questions')
      .update({ 
        question_subtype: 'error_detection',
        question_text: 'Su tarea consiste en localizar los errores ortográficos cometidos en la siguiente frase y marcar la opción de respuesta que indique dichos errores:',
        content_data: {
          chart_type: 'text_analysis',
          question_type: 'orthographic_error_detection',
          original_text: 'Después de las intensas lluvias, tuvimos que desharancar el aljibe que estaba situado en lo alto del vastión',
          evaluation_description: 'Localizar errores ortográficos en la frase dada'
        }
      })
      .eq('id', '92187834-624c-4057-8127-840ad20ad4b0')
      .select()

    if (error10) {
      console.error('❌ Error actualizando pregunta 10:', error10)
    } else {
      console.log('✅ Pregunta 10 corregida')
    }

    console.log('✅ Todas las preguntas error_detection corregidas')

  } catch (error) {
    console.error('❌ Error en script de corrección:', error)
  }
}

fixErrorDetectionQuestions()
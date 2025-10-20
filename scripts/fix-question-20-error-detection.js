import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function fixQuestion20() {
  try {
    // Corregir pregunta 20 para usar error_detection
    const { data, error } = await supabase
      .from('psychometric_questions')
      .update({ 
        question_subtype: 'error_detection',
        question_text: 'Su tarea consiste en localizar los errores ortográficos cometidos en la siguiente frase y marcar la opción de respuesta que indique dichos errores:',
        content_data: {
          chart_type: 'text_analysis',
          question_type: 'orthographic_error_detection',
          original_text: 'La explosión en la cantera arrojo güijarros, graba y piedras a lo largo de todo el camino',
          evaluation_description: 'Localizar errores ortográficos en frase y contar'
        }
      })
      .eq('id', '2d23989c-d8ea-40f1-9a10-1079f15cad81')
      .select()

    if (error) {
      console.error('❌ Error actualizando pregunta 20:', error)
    } else {
      console.log('✅ Pregunta 20 corregida a error_detection')
    }

    // También corregir pregunta 21 que tiene el mismo problema
    const { data: data21, error: error21 } = await supabase
      .from('psychometric_questions')
      .update({ 
        question_subtype: 'error_detection',
        question_text: 'Localice los errores ortográficos que se han cometido en la siguiente frase y marque la opción de respuesta que indique dichos errores:',
        content_data: {
          chart_type: 'text_analysis',
          question_type: 'orthographic_error_detection',
          original_text: 'El afamado modisto enebraba la aguja para hacer un iIván en el chaqué y la levita del invitado a la ceremonia',
          evaluation_description: 'Localizar errores ortográficos en frase'
        }
      })
      .eq('id', '7d509265-3458-4868-9fa2-e4d29651c709')
      .select()

    if (error21) {
      console.error('❌ Error actualizando pregunta 21:', error21)
    } else {
      console.log('✅ Pregunta 21 también corregida a error_detection')
    }

    console.log('✅ Preguntas 20 y 21 corregidas para mostrar cuadro azul')

  } catch (error) {
    console.error('❌ Error en script de corrección:', error)
  }
}

fixQuestion20()
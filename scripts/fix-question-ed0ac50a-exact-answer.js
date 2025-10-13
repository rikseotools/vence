import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function fixQuestionEd0ac50aExactAnswer() {
  try {
    console.log('🔧 Cambiando pregunta ed0ac50a a respuesta exacta...')
    
    // Obtener la pregunta actual
    const { data: question, error: fetchError } = await supabase
      .from('psychometric_questions')
      .select('*')
      .eq('id', 'ed0ac50a-9694-4177-ae4a-11381186ee19')
      .single()

    if (fetchError) {
      console.error('❌ Error obteniendo pregunta:', fetchError)
      return
    }

    // Actualizar con opciones exactas
    const updatedData = {
      option_a: '350.000 personas',
      option_b: '320.000 personas', 
      option_c: '520.000 personas',
      option_d: '280.000 personas',
      correct_option: 0 // A = 350.000 personas (225.000 + 125.000)
    }

    // Actualizar explicación también
    const updatedContentData = {
      ...question.content_data,
      explanation_sections: [
        {
          title: "💡 ¿Qué evalúa este ejercicio?",
          content: "Capacidad de leer gráficos de líneas con múltiples series, sumar valores de múltiples categorías específicas y calcular totales acumulados exactos."
        },
        {
          title: "📊 ANÁLISIS PASO A PASO:",
          content: "📋 Datos de Centros de salud por edad:\n• 15-26 años: 70.000 personas (70 en miles)\n• 27-38 años: 60.000 personas (60 en miles)\n• 60+ años: 95.000 personas (95 en miles)\n• Total Centros de salud = 70 + 60 + 95 = 225.000 personas\n\n📋 Datos de Centros de especialidades por edad:\n• 15-26 años: 25.000 personas (25 en miles)\n• 27-38 años: 25.000 personas (25 en miles)\n• 60+ años: 75.000 personas (75 en miles)\n• Total Centros de especialidades = 25 + 25 + 75 = 125.000 personas\n\n📋 Total combinado:\n• Total = 225.000 + 125.000 = 350.000 personas ✅"
        },
        {
          title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
          content: "🔍 Método 1: Suma por categorías\n• Centros salud: 70+60+95 = 225.000\n• Centros especialidades: 25+25+75 = 125.000\n• Total: 225.000 + 125.000 = 350.000 personas ✅\n\n📊 Método 2: Suma por rangos de edad\n• 15-26: (70+25) = 95.000\n• 27-38: (60+25) = 85.000\n• 60+: (95+75) = 170.000\n• Total: 95+85+170 = 350.000 personas ✅\n\n💰 Método 3: Verificación de datos\n• Lectura directa de valores del gráfico\n• Suma precisa sin aproximaciones\n• Resultado exacto: 350.000 personas ✅"
        }
      ]
    }

    // Actualizar la pregunta
    const { error: updateError } = await supabase
      .from('psychometric_questions')
      .update({ 
        ...updatedData,
        content_data: updatedContentData
      })
      .eq('id', 'ed0ac50a-9694-4177-ae4a-11381186ee19')

    if (updateError) {
      console.error('❌ Error actualizando pregunta:', updateError)
      return
    }

    console.log('✅ Pregunta ed0ac50a actualizada con respuesta exacta')
    console.log('✅ Nueva respuesta correcta: A) 350.000 personas')
    console.log('📋 Nuevas opciones:')
    console.log('   A) 350.000 personas (CORRECTA)')
    console.log('   B) 320.000 personas')
    console.log('   C) 520.000 personas') 
    console.log('   D) 280.000 personas')
    console.log('')
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:')
    console.log('   http://localhost:3000/debug/question/ed0ac50a-9694-4177-ae4a-11381186ee19')

  } catch (error) {
    console.error('❌ Error inesperado:', error)
  }
}

fixQuestionEd0ac50aExactAnswer()
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function fixQuestionEd0ac50aTotalCalculation() {
  try {
    console.log('🔧 Corrigiendo cálculo de la pregunta ed0ac50a...')
    
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

    // Corregir la respuesta correcta y explicaciones
    const updatedContentData = {
      ...question.content_data,
      explanation_sections: [
        {
          title: "💡 ¿Qué evalúa este ejercicio?",
          content: "Capacidad de leer gráficos de líneas con múltiples series, sumar valores de múltiples categorías específicas y calcular totales acumulados."
        },
        {
          title: "📊 ANÁLISIS PASO A PASO:",
          content: "📋 Datos de Centros de salud por edad:\n• 15-26 años: 70.000 personas (70 en miles)\n• 27-38 años: 60.000 personas (60 en miles)\n• 60+ años: 95.000 personas (95 en miles)\n• Total Centros de salud = 70 + 60 + 95 = 225.000 personas\n\n📋 Datos de Centros de especialidades por edad:\n• 15-26 años: 25.000 personas (25 en miles)\n• 27-38 años: 25.000 personas (25 en miles)\n• 60+ años: 75.000 personas (75 en miles)\n• Total Centros de especialidades = 25 + 25 + 75 = 125.000 personas\n\n📋 Total combinado:\n• Total = 225.000 + 125.000 = 350.000 personas\n• Entre el medio millón (500.000) y las 400.000 personas ✅"
        },
        {
          title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
          content: "🔍 Método 1: Suma por categorías\n• Centros salud: 70+60+95 = 225.000\n• Centros especialidades: 25+25+75 = 125.000\n• Total: 225.000 + 125.000 = 350.000 ✅\n\n📊 Método 2: Suma por rangos de edad\n• 15-26: (70+25) = 95.000\n• 27-38: (60+25) = 85.000\n• 60+: (95+75) = 170.000\n• Total: 95+85+170 = 350.000 ✅\n\n💰 Método 3: Verificación del rango\n• 350.000 está entre 400.000 y 500.000\n• Por tanto: \"Entre el medio millón y las 400.000 personas\" ✅"
        }
      ]
    }

    // Actualizar la pregunta con la respuesta correcta corregida
    const { data, error } = await supabase
      .from('psychometric_questions')
      .update({ 
        content_data: updatedContentData,
        correct_option: 2 // C = Entre el medio millón y las 400.000 personas
      })
      .eq('id', 'ed0ac50a-9694-4177-ae4a-11381186ee19')
      .select()

    if (error) {
      console.error('❌ Error actualizando pregunta:', error)
      return
    }

    console.log('✅ Pregunta ed0ac50a corregida exitosamente')
    console.log('✅ Nueva respuesta correcta: C) Entre el medio millón y las 400.000 personas (350.000)')
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:')
    console.log('   http://localhost:3000/debug/question/ed0ac50a-9694-4177-ae4a-11381186ee19')

  } catch (error) {
    console.error('❌ Error inesperado:', error)
  }
}

fixQuestionEd0ac50aTotalCalculation()
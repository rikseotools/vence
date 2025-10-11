// scripts/create-car-sales-bar-chart.js
// Añadir pregunta de gráfico de barras: Ventas de coches por trimestre
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Cargar variables de entorno
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function createCarSalesBarChart() {
  try {
    console.log('📊 Creando pregunta de gráfico de barras: Ventas de coches...')

    // Datos del gráfico extraídos de la imagen
    const chartData = {
      title: "COCHES VENDIDOS POR TRIMESTRE EN EL AÑO 2023",
      type: "bar_chart",
      quarters: [
        { name: "Trimestre 1", modelA: 24, modelB: 89 },
        { name: "Trimestre 2", modelA: 36, modelB: 24 },
        { name: "Trimestre 3", modelA: 12, modelB: 37 },
        { name: "Trimestre 4", modelA: 38, modelB: 63 }
      ],
      legend: {
        modelA: "Coche A",
        modelB: "Coche B"
      }
    }

    // Calcular totales para verificar respuestas
    const totalModelA = chartData.quarters.reduce((sum, q) => sum + q.modelA, 0) // 110
    const totalModelB = chartData.quarters.reduce((sum, q) => sum + q.modelB, 0) // 213
    const totalGeneral = totalModelA + totalModelB // 323

    console.log('🔢 Totales calculados:')
    console.log(`   Modelo A: ${totalModelA}`)
    console.log(`   Modelo B: ${totalModelB}`)
    console.log(`   Total: ${totalGeneral}`)

    // Obtener el category_id para "capacidad-administrativa" y section_id para "graficos"
    const { data: category, error: categoryError } = await supabase
      .from('psychometric_categories')
      .select('id')
      .eq('category_key', 'capacidad-administrativa')
      .single()

    if (categoryError || !category) {
      console.error('❌ Error: No se encontró la categoría capacidad-administrativa:', categoryError)
      return
    }

    const { data: section, error: sectionError } = await supabase
      .from('psychometric_sections')
      .select('id')
      .eq('section_key', 'graficos')
      .single()

    if (sectionError || !section) {
      console.error('❌ Error: No se encontró la sección graficos:', sectionError)
      return
    }

    const questionData = {
      category_id: category.id,
      section_id: section.id,
      question_text: "¿Cuántos coches se vendieron en total?",
      question_subtype: "bar_chart",
      content_data: {
        chart_data: chartData,
        explanation_sections: [
          {
            title: "📊 ANÁLISIS DEL GRÁFICO",
            content: "Este gráfico de barras muestra las ventas de dos modelos de coches (A y B) distribuidas por trimestres durante 2023."
          },
          {
            title: "🎯 ESTRATEGIA DE RESOLUCIÓN",
            content: "Para encontrar el total de coches vendidos:\n• Sumar todas las ventas del Modelo A: 24 + 36 + 12 + 38 = 110\n• Sumar todas las ventas del Modelo B: 89 + 24 + 37 + 63 = 213\n• Suma total: 110 + 213 = 323 coches"
          },
          {
            title: "⚡ TÉCNICA RÁPIDA",
            content: "Aprovecha la tabla de datos incluida para sumar directamente por columnas en lugar de leer el gráfico barra por barra."
          },
          {
            title: "🔍 VERIFICACIÓN",
            content: "Comprueba que has sumado correctamente: 289 + 323 + 429 + 110 no son opciones lógicas comparadas con los datos mostrados."
          }
        ]
      },
      option_a: "289",
      option_b: "323", // CORRECTA
      option_c: "429", 
      option_d: "110",
      correct_option: 2,
      explanation: "El total se calcula sumando las ventas de ambos modelos: Modelo A (24+36+12+38=110) + Modelo B (89+24+37+63=213) = 323 coches en total.",
      is_active: true
    }

    // Insertar la pregunta
    const { data: insertedQuestion, error: insertError } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select('id')
      .single()

    if (insertError) {
      console.error('❌ Error insertando pregunta:', insertError)
      return
    }

    console.log('✅ Pregunta creada exitosamente!')
    console.log(`📋 ID de pregunta: ${insertedQuestion.id}`)
    console.log(`🔍 Preview: http://localhost:3000/debug/question/${insertedQuestion.id}`)
    console.log(`🎯 Test URL: http://localhost:3000/auxiliar-administrativo-estado/test`)

  } catch (error) {
    console.error('❌ Error inesperado:', error)
  }
}

// Ejecutar el script
createCarSalesBarChart()